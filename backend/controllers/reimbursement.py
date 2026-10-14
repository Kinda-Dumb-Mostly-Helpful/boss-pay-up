from fastapi import APIRouter, HTTPException, Request
from backend.utils.reimbursement_rules import ensure_editable
from typing import List, Optional
import psycopg2
import psycopg2.extras
import uuid
from backend.controllers.batches import ensure_unbatched
from pydantic import BaseModel, Field

from backend.schemas.reimbursement import (
    ReimbursementCreate,
    ReimbursementUpdate,
    ReimbursementResponse,
    ReimbursementWithDepartmentResponse,
    DepartmentInfo,
)
from backend.utils.helpers import reimbursement_row_to_dict
from backend.database.connection import get_db_connection, get_db_cursor

router = APIRouter(prefix="/api/reimbursements", tags=["reimbursements"])


class MarkReimbursedRequest(BaseModel):
    ids: List[str] = Field(min_length=1, max_length=1000)


@router.post("/mark-reimbursed")
def mark_reimbursed(request: MarkReimbursedRequest):
    ids = list(dict.fromkeys(request.ids))
    with get_db_connection() as conn, conn.cursor() as cursor:
        for record_id in sorted(set(ids)):
            ensure_editable(cursor, record_id)
        ensure_unbatched(cursor, ids)
        cursor.execute("SELECT id FROM reimbursements WHERE id = ANY(%s) FOR UPDATE", (ids,))
        if len(cursor.fetchall()) != len(ids):
            raise HTTPException(status_code=409, detail="部分记录已删除，请刷新后重试")
        cursor.execute(
            "UPDATE reimbursements SET status = %s WHERE id = ANY(%s) AND status <> %s",
            ("已报销", ids, "已报销"),
        )
        updated = cursor.rowcount
        conn.commit()
    return {"updated": updated}


def reimbursement_with_department_row_to_dict(row):
    """Convert a joined row (reimbursement + department) to dictionary."""
    # Row columns: reimbursement.*, departments.id, departments.name, departments.description, departments.created_at
    # Assuming columns order:
    # 0: reimbursement.id, 1: desc, 2: amount, 3: category, 4: date, 5: status, 6: department_id, 7: receipt_filename, 8: created_at
    # Then department columns: 9: dept_id, 10: dept_name, 11: dept_description, 12: dept_created_at
    # Actually we need to check the exact column order from the JOIN query

    # For now, let's assume the JOIN query returns:
    # r.id, r.desc, r.amount, r.category, r.date, r.status, r.department_id, r.receipt_filename, r.created_at,
    # d.id, d.name, d.description, d.created_at
    return {
        "id": row[0],
        "desc": row[1],
        "amount": row[2],
        "category": row[3],
        "date": row[4],
        "status": row[5],
        "department_id": row[6],
        "receipt_filename": row[7] if len(row) > 7 else None,
        "void_reason": row[13] if len(row) > 13 else None,
        "void_operator": row[14] if len(row) > 14 else None,
        "void_at": str(row[15]) if len(row) > 15 and row[15] else None,
        "department": {
            "id": row[9],
            "name": row[10],
            "description": row[11],
            "created_at": str(row[12]) if row[12] is not None else None,
        },
    }


@router.get("/", response_model=List[ReimbursementWithDepartmentResponse])
def get_reimbursements(
    search: Optional[str] = None, department_id: Optional[str] = None
):
    conn, cursor = get_db_cursor()

    try:
        # Use JOIN to get department information
        query = """
            SELECT r.*, d.id as dept_id, d.name as dept_name,
                   d.description as dept_description, d.created_at as dept_created_at,
                   v.reason, v.operator, v.created_at
            FROM reimbursements r
            LEFT JOIN departments d ON r.department_id = d.id
            LEFT JOIN reimbursement_voids v ON v.reimbursement_id = r.id
        """
        params = []

        conditions = []
        if search:
            conditions.append(
                "(r.desc ILIKE %s OR r.category ILIKE %s OR r.status ILIKE %s OR CAST(r.amount AS TEXT) ILIKE %s)"
            )
            params.extend([f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%"])

        if department_id:
            conditions.append("r.department_id = %s")
            params.append(department_id)

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY r.date DESC"

        cursor.execute(query, params)
        rows = cursor.fetchall()

        return [reimbursement_with_department_row_to_dict(row) for row in rows]
    finally:
        cursor.close()
        conn.close()


@router.get("/{id}", response_model=ReimbursementWithDepartmentResponse)
def get_reimbursement(id: str):
    conn, cursor = get_db_cursor()

    try:
        # Use JOIN to get department information
        cursor.execute(
            """
            SELECT r.*, d.id as dept_id, d.name as dept_name,
                   d.description as dept_description, d.created_at as dept_created_at,
                   v.reason, v.operator, v.created_at
            FROM reimbursements r
            LEFT JOIN departments d ON r.department_id = d.id
            LEFT JOIN reimbursement_voids v ON v.reimbursement_id = r.id
            WHERE r.id = %s
        """,
            (id,),
        )

        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Reimbursement not found")

        return reimbursement_with_department_row_to_dict(row)
    finally:
        cursor.close()
        conn.close()


def validate_department(cursor, department_id):
    cursor.execute("SELECT 1 FROM departments WHERE id = %s", (department_id,))
    if cursor.fetchone() is None:
        raise HTTPException(status_code=400, detail="部门不存在")


@router.post("/", response_model=ReimbursementResponse)
def create_reimbursement(reimbursement: ReimbursementCreate):
    new_id = str(uuid.uuid4())
    with get_db_connection() as conn, conn.cursor() as cursor:
        validate_department(cursor, reimbursement.department_id)
        cursor.execute(
            'INSERT INTO reimbursements (id, "desc", amount, category, date, status, department_id, receipt_filename) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)',
            (new_id, reimbursement.desc, reimbursement.amount, reimbursement.category,
             reimbursement.date, reimbursement.status, reimbursement.department_id,
             reimbursement.receipt_filename),
        )
        conn.commit()
    return {"id": new_id, **reimbursement.model_dump()}


@router.put("/{id}", response_model=ReimbursementResponse)
def update_reimbursement(id: str, reimbursement: ReimbursementUpdate):
    with get_db_connection() as conn, conn.cursor() as cursor:
        ensure_editable(cursor, id)
        ensure_unbatched(cursor, [id])
        validate_department(cursor, reimbursement.department_id)
        cursor.execute(
            'UPDATE reimbursements SET "desc" = %s, amount = %s, category = %s, date = %s, status = %s, department_id = %s, receipt_filename = %s WHERE id = %s',
            (reimbursement.desc, reimbursement.amount, reimbursement.category,
             reimbursement.date, reimbursement.status, reimbursement.department_id,
             reimbursement.receipt_filename, id),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="报销记录不存在")
        conn.commit()
    return {"id": id, **reimbursement.model_dump()}


@router.delete("/{id}")
def delete_reimbursement(id: str):
    raise HTTPException(405, "报销明细不可删除，请填写原因后报废")


class VoidRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=1000)


@router.post("/{id}/void")
def void_reimbursement(id: str, data: VoidRequest, request: Request):
    reason = data.reason.strip()
    if not reason:
        raise HTTPException(422, "请填写报废原因")
    user = request.state.user
    with get_db_connection() as conn, conn.cursor() as cursor:
        ensure_editable(cursor, id)
        ensure_unbatched(cursor, [id])
        cursor.execute("INSERT INTO reimbursement_voids(reimbursement_id,reason,operator,operator_id) VALUES(%s,%s,%s,%s)",
                       (id, reason, f"{user['display_name']}（{user['username']}）", user['id']))
        cursor.execute("UPDATE reimbursements SET status='已报废' WHERE id=%s", (id,))
        conn.commit()
    return {"message": "报销明细已报废，记录及原因已保留"}
