from fastapi import HTTPException


def ensure_editable(cursor, reimbursement_id):
    cursor.execute("SELECT status FROM reimbursements WHERE id=%s FOR UPDATE", (reimbursement_id,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(404, "报销记录不存在")
    if row[0] in ('已报销', '已报废'):
        raise HTTPException(409, "已报销或已报废的明细不可编辑、修改附件或报废")
