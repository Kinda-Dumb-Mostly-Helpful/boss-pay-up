from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from typing import List
from backend.database.connection import get_db_cursor
import uuid
import os
import shutil
from datetime import datetime

from backend.schemas.image import ReceiptImageResponse
from backend.utils.helpers import image_row_to_dict
from backend.controllers.batches import ensure_unbatched
from backend.utils.reimbursement_rules import ensure_editable

router = APIRouter(prefix="/api", tags=["uploads"])


def save_upload_file(file: UploadFile) -> tuple[str, str, str]:
    # Create uploads directory if it doesn't exist
    upload_dir = "backend/uploads"
    os.makedirs(upload_dir, exist_ok=True)

    # Generate unique filename and save file
    file_extension = os.path.splitext(file.filename or "")[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    filepath = os.path.join(upload_dir, unique_filename)

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return unique_filename, filepath, upload_dir


@router.post("/uploads")
async def upload_image(file: UploadFile = File(...)):
    unique_filename, filepath, _ = save_upload_file(file)
    return {
        "filename": file.filename,
        "stored_filename": unique_filename,
        "filepath": filepath,
        "uploaded_at": datetime.now().isoformat(),
    }


@router.post("/reimbursements/{reimbursement_id}/images")
async def upload_receipt_image(reimbursement_id: str, file: UploadFile = File(...)):
    # Check if reimbursement exists
    conn, cursor = get_db_cursor()
    try:
        ensure_editable(cursor, reimbursement_id)
        ensure_unbatched(cursor, [reimbursement_id])
    except Exception:
        conn.close()
        raise
    cursor.execute(
        "SELECT COUNT(*) FROM reimbursements WHERE id = %s", (reimbursement_id,)
    )
    if cursor.fetchone()[0] == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Reimbursement not found")

    unique_filename, filepath, _ = save_upload_file(file)

    # Save to database - create receipt_images record and update reimbursement
    image_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO receipt_images (id, reimbursement_id, filename, filepath) VALUES (%s, %s, %s, %s)",
        (image_id, reimbursement_id, file.filename, filepath),
    )

    # Also update reimbursement record with filename (store UUID filename for serving)
    cursor.execute(
        "UPDATE reimbursements SET receipt_filename = COALESCE(receipt_filename, %s) WHERE id = %s",
        (unique_filename, reimbursement_id),
    )

    conn.commit()
    conn.close()

    return {
        "id": image_id,
        "reimbursement_id": reimbursement_id,
        "filename": file.filename,
        "filepath": filepath,
        "uploaded_at": datetime.now().isoformat(),
    }


@router.get(
    "/reimbursements/{reimbursement_id}/images",
    response_model=List[ReceiptImageResponse],
)
def get_receipt_images(reimbursement_id: str):
    # Check if reimbursement exists
    conn, cursor = get_db_cursor()
    cursor.execute(
        "SELECT COUNT(*) FROM reimbursements WHERE id = %s", (reimbursement_id,)
    )
    if cursor.fetchone()[0] == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Reimbursement not found")

    # Get images
    cursor.execute(
        "SELECT * FROM receipt_images WHERE reimbursement_id = %s ORDER BY uploaded_at DESC",
        (reimbursement_id,),
    )
    rows = cursor.fetchall()
    conn.close()

    return [image_row_to_dict(row) for row in rows]


@router.delete("/images/{image_id}")
def delete_receipt_image(image_id: str):
    conn, cursor = get_db_cursor()
    cursor.execute("SELECT reimbursement_id FROM receipt_images WHERE id=%s", (image_id,))
    owner = cursor.fetchone()
    if owner:
        try:
            ensure_editable(cursor, owner[0])
            ensure_unbatched(cursor, [owner[0]])
            cursor.execute("SELECT 1 FROM approval_batch_items WHERE reimbursement_id=%s LIMIT 1", (owner[0],))
            if cursor.fetchone():
                raise HTTPException(409, "该图片属于历史审批档案，不能删除")
        except Exception:
            conn.close()
            raise

    # Get image filepath before deleting
    cursor.execute("SELECT filepath FROM receipt_images WHERE id = %s", (image_id,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Image not found")

    filepath = row[0]

    # Delete from database
    cursor.execute("DELETE FROM receipt_images WHERE id = %s", (image_id,))
    deleted = cursor.rowcount > 0
    cursor.execute("UPDATE reimbursements SET receipt_filename = NULL WHERE receipt_filename = %s", (os.path.basename(filepath),))
    conn.commit()
    conn.close()

    if not deleted:
        raise HTTPException(status_code=404, detail="Image not found")

    # Delete file if exists
    if os.path.exists(filepath):
        os.remove(filepath)

    return {"message": "Image deleted successfully"}


@router.get("/upload/{filename}")
async def get_uploaded_image(filename: str):
    """Serve uploaded image file by filename."""
    upload_dir = "backend/uploads"
    filepath = os.path.join(upload_dir, filename)

    # Security check: ensure filename doesn't contain path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Image not found")

    # Determine media type based on file extension
    media_type = None
    if filename.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp")):
        media_type = "image/" + filename.lower().split(".")[-1]
        if media_type == "image/jpg":
            media_type = "image/jpeg"

    return FileResponse(filepath, media_type=media_type)
