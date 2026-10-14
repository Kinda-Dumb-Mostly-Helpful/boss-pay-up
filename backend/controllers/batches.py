import uuid
from datetime import datetime
from typing import Literal
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from psycopg2.extras import Json, RealDictCursor
from backend.database.connection import get_db_connection

router = APIRouter(prefix="/api/approval-batches", tags=["approval batches"])


def init_batches():
    with get_db_connection() as conn, conn.cursor() as cursor:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS approval_batches (
                id TEXT PRIMARY KEY, title TEXT NOT NULL, currency TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT '待审批', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS approval_batch_items (
                batch_id TEXT REFERENCES approval_batches(id), reimbursement_id TEXT NOT NULL,
                snapshot JSONB NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
                PRIMARY KEY (batch_id, reimbursement_id)
            );
            CREATE UNIQUE INDEX IF NOT EXISTS one_active_batch_per_item
                ON approval_batch_items(reimbursement_id) WHERE active;
            CREATE TABLE IF NOT EXISTS approval_batch_events (
                id BIGSERIAL PRIMARY KEY, batch_id TEXT REFERENCES approval_batches(id),
                action TEXT NOT NULL, operator TEXT NOT NULL, note TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE approval_batch_events ADD COLUMN IF NOT EXISTS operator_id TEXT;
        """)
        conn.commit()


def ensure_unbatched(cursor, ids):
    cursor.execute("SELECT id FROM reimbursements WHERE id = ANY(%s) ORDER BY id FOR UPDATE", (ids,))
    cursor.execute("SELECT 1 FROM approval_batch_items WHERE reimbursement_id = ANY(%s) AND active LIMIT 1", (ids,))
    if cursor.fetchone():
        raise HTTPException(409, "明细已归入审批批次，请在批次档案中处理；驳回后可修改并重新提交")


class CreateBatch(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=1000)
    title: str = Field(default="", max_length=100)
    currency: Literal["CNY", "USD", "KHR", "VND", "INR", "EUR", "HKD", "SGD"] = "CNY"


class BatchAction(BaseModel):
    action: Literal["approve", "reject", "reimburse"]
    note: str = Field(default="", max_length=1000)


@router.get("")
def list_batches():
    with get_db_connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute("SELECT * FROM approval_batches ORDER BY created_at DESC, id")
        batches = cursor.fetchall()
        for batch in batches:
            cursor.execute("SELECT snapshot FROM approval_batch_items WHERE batch_id=%s ORDER BY reimbursement_id", (batch['id'],))
            batch['items'] = [row['snapshot'] for row in cursor.fetchall()]
            cursor.execute("SELECT action, operator, note, created_at FROM approval_batch_events WHERE batch_id=%s ORDER BY id", (batch['id'],))
            batch['events'] = cursor.fetchall()
        return batches


@router.post("")
def create_batch(request: CreateBatch, http_request: Request):
    user = http_request.state.user
    operator = f"{user['display_name']}（{user['username']}）"
    ids = sorted(set(request.ids))
    batch_id = str(uuid.uuid4())
    with get_db_connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cursor:
        ensure_unbatched(cursor, ids)
        cursor.execute('''SELECT r.*, json_build_object('id',d.id,'name',d.name,
            'description',d.description,'created_at',d.created_at) AS department
            FROM reimbursements r JOIN departments d ON d.id=r.department_id WHERE r.id=ANY(%s)''', (ids,))
        rows = cursor.fetchall()
        if len(rows) != len(ids) or any(row['status'] != '待审批' for row in rows):
            raise HTTPException(409, "只能选择待审批的明细，请刷新后重新选择")
        title = request.title.strip() or f"审批组-{datetime.now():%Y%m%d-%H%M%S}-{batch_id[:6]}"
        cursor.execute("INSERT INTO approval_batches(id,title,currency) VALUES(%s,%s,%s)", (batch_id, title, request.currency))
        for row in rows:
            row.pop('created_at', None)
            cursor.execute("SELECT filename, filepath FROM receipt_images WHERE reimbursement_id=%s", (row['id'],))
            row['attachments'] = [dict(image) for image in cursor.fetchall()]
            cursor.execute("INSERT INTO approval_batch_items(batch_id,reimbursement_id,snapshot) VALUES(%s,%s,%s)", (batch_id, row['id'], Json(dict(row))))
        cursor.execute("UPDATE reimbursements SET status='待审批' WHERE id=ANY(%s)", (ids,))
        cursor.execute("INSERT INTO approval_batch_events(batch_id,action,operator,note,operator_id) VALUES(%s,'提交',%s,'',%s)", (batch_id, operator, user['id']))
        conn.commit()
    return {"id": batch_id}


@router.post("/{batch_id}/actions")
def act_on_batch(batch_id: str, request: BatchAction, http_request: Request):
    user = http_request.state.user
    operator = f"{user['display_name']}（{user['username']}）"
    with get_db_connection() as conn, conn.cursor() as cursor:
        cursor.execute("SELECT status FROM approval_batches WHERE id=%s FOR UPDATE", (batch_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(404, "批次不存在")
        source, target = {"approve": ("待审批", "已批准"), "reject": ("待审批", "已驳回"), "reimburse": ("已批准", "已报销")}[request.action]
        if row[0] != source:
            raise HTTPException(409, "批次状态已变化，请刷新；只有已批准批次可标记已报销")
        cursor.execute("SELECT reimbursement_id FROM approval_batch_items WHERE batch_id=%s ORDER BY reimbursement_id", (batch_id,))
        ids = [item[0] for item in cursor.fetchall()]
        cursor.execute("SELECT id FROM reimbursements WHERE id=ANY(%s) ORDER BY id FOR UPDATE", (ids,))
        if len(cursor.fetchall()) != len(ids):
            raise HTTPException(409, "批次明细缺失，无法处理")
        if request.action in ('reject', 'reimburse'):
            cursor.execute("UPDATE reimbursements SET status=%s WHERE id=ANY(%s)", ('驳回' if request.action == 'reject' else '已报销', ids))
        if request.action == 'reject':
            cursor.execute("UPDATE approval_batch_items SET active=FALSE WHERE batch_id=%s", (batch_id,))
        cursor.execute("UPDATE approval_batches SET status=%s WHERE id=%s", (target, batch_id))
        cursor.execute("INSERT INTO approval_batch_events(batch_id,action,operator,note,operator_id) VALUES(%s,%s,%s,%s,%s)", (batch_id, target, operator, request.note.strip(), user['id']))
        conn.commit()
    return {"status": target}
