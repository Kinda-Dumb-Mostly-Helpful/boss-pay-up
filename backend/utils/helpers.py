# Helper functions for converting database rows to dictionaries


def department_row_to_dict(row):
    return {
        "id": row[0],
        "name": row[1],
        "description": row[2],
        "created_at": str(row[3]) if row[3] is not None else None,
    }


def reimbursement_row_to_dict(row):
    # row columns: id, desc, amount, category, date, status, department_id, receipt_filename, created_at
    # receipt_filename is at index 7 (if exists)
    return {
        "id": row[0],
        "desc": row[1],
        "amount": row[2],
        "category": row[3],
        "date": row[4],
        "status": row[5],
        "department_id": row[6],
        "receipt_filename": row[7] if len(row) > 7 else None,
    }


def image_row_to_dict(row):
    return {
        "id": row[0],
        "reimbursement_id": row[1],
        "filename": row[2],
        "filepath": row[3],
        "uploaded_at": str(row[4]),
    }
