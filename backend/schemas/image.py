from pydantic import BaseModel


class ReceiptImageBase(BaseModel):
    filename: str
    filepath: str


class ReceiptImageCreate(ReceiptImageBase):
    pass


class ReceiptImageResponse(ReceiptImageBase):
    id: str
    reimbursement_id: str
    uploaded_at: str
