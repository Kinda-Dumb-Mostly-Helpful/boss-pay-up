from fastapi import APIRouter, HTTPException
from typing import List
import psycopg2
import uuid
from datetime import datetime

from backend.schemas.department import DepartmentCreate, DepartmentResponse
from backend.utils.helpers import department_row_to_dict
from backend.database.connection import get_db_connection, get_db_cursor

router = APIRouter(prefix="/api/departments", tags=["departments"])


@router.get("/", response_model=List[DepartmentResponse])
def get_departments():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM departments ORDER BY name")
        rows = cursor.fetchall()
        return [department_row_to_dict(row) for row in rows]


@router.get("/{id}", response_model=DepartmentResponse)
def get_department(id: str):
    conn, cursor = get_db_cursor()
    try:
        cursor.execute("SELECT * FROM departments WHERE id = %s", (id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Department not found")
        return department_row_to_dict(row)
    finally:
        cursor.close()
        conn.close()


@router.post("/", response_model=DepartmentResponse)
def create_department(department: DepartmentCreate):
    new_id = str(uuid.uuid4())
    conn = sqlite3.connect("reimbursements.db")
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO departments (id, name, description) VALUES (?, ?, ?)",
            (new_id, department.name, department.description),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Department name already exists")
    conn.close()

    # Return the created department
    return {
        "id": new_id,
        "name": department.name,
        "description": department.description,
        "created_at": datetime.now().isoformat(),
    }


@router.put("/{id}", response_model=DepartmentResponse)
def update_department(id: str, department: DepartmentCreate):
    conn = sqlite3.connect("reimbursements.db")
    cursor = conn.cursor()

    # Check if exists
    cursor.execute("SELECT COUNT(*) FROM departments WHERE id = ?", (id,))
    if cursor.fetchone()[0] == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Department not found")

    try:
        cursor.execute(
            "UPDATE departments SET name = ?, description = ? WHERE id = ?",
            (department.name, department.description, id),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Department name already exists")

    # Get updated department
    cursor.execute("SELECT * FROM departments WHERE id = ?", (id,))
    row = cursor.fetchone()
    conn.close()

    return department_row_to_dict(row)


@router.delete("/{id}")
def delete_department(id: str):
    conn = sqlite3.connect("reimbursements.db")
    cursor = conn.cursor()

    cursor.execute("DELETE FROM departments WHERE id = ?", (id,))
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()

    if not deleted:
        raise HTTPException(status_code=404, detail="Department not found")

    return {"message": "Department deleted successfully"}


@router.get("/{id}/stats")
def get_department_stats(id: str):
    conn = sqlite3.connect("reimbursements.db")
    cursor = conn.cursor()

    # Check if department exists
    cursor.execute("SELECT COUNT(*) FROM departments WHERE id = ?", (id,))
    if cursor.fetchone()[0] == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Department not found")

    cursor.execute("SELECT COUNT(*) FROM reimbursements WHERE department_id = ?", (id,))
    total_count = cursor.fetchone()[0]

    cursor.execute(
        "SELECT SUM(amount) FROM reimbursements WHERE department_id = ?", (id,)
    )
    total_amount = cursor.fetchone()[0] or 0

    cursor.execute(
        "SELECT COUNT(*) FROM reimbursements WHERE department_id = ? AND status = '待审批'",
        (id,),
    )
    pending_count = cursor.fetchone()[0]

    conn.close()

    return {
        "department_id": id,
        "totalCount": total_count,
        "totalAmount": total_amount,
        "pendingCount": pending_count,
    }
