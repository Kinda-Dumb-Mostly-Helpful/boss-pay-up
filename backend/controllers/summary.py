from fastapi import APIRouter
from typing import Optional
from backend.database.connection import get_db_cursor

router = APIRouter(prefix="/api", tags=["summary"])


@router.get("/summary")
def get_summary(department_id: Optional[str] = None):
    conn, cursor = get_db_cursor()

    where_clause = "WHERE department_id = %s" if department_id else ""
    params = [department_id] if department_id else []

    cursor.execute(f"SELECT COUNT(*) FROM reimbursements {where_clause}", params)
    total_count = cursor.fetchone()[0]

    cursor.execute(f"SELECT SUM(amount) FROM reimbursements WHERE status <> '已报废' {('AND department_id = %s' if department_id else '')}", params)
    total_amount = cursor.fetchone()[0] or 0

    cursor.execute(
        f"SELECT COUNT(*) FROM reimbursements WHERE status = '待审批' {('AND department_id = %s' if department_id else '')}",
        params,
    )
    pending_count = cursor.fetchone()[0]

    cursor.close()
    conn.close()

    return {
        "totalCount": total_count,
        "totalAmount": total_amount,
        "pendingCount": pending_count,
    }
