from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal
from datetime import date as Date


class ReimbursementBase(BaseModel):
    desc: str
    amount: float = Field(gt=0, allow_inf_nan=False)
    category: str
    date: str
    status: Literal["待审批", "已报销", "驳回"]
    department_id: str
    receipt_filename: Optional[str] = None

    @field_validator("desc", "category", "department_id")
    @classmethod
    def non_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("不能为空")
        return value.strip()

    @field_validator("date")
    @classmethod
    def valid_date(cls, value: str) -> str:
        return Date.fromisoformat(value).isoformat()


class ReimbursementCreate(ReimbursementBase):
    pass


class ReimbursementUpdate(ReimbursementBase):
    pass


class ReimbursementResponse(ReimbursementBase):
    id: str


class DepartmentInfo(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    created_at: str


class ReimbursementWithDepartmentResponse(BaseModel):
    attachments: list[dict[str, str]] = Field(default_factory=list)
    void_reason: Optional[str] = None
    void_operator: Optional[str] = None
    void_at: Optional[str] = None
    id: str
    desc: str
    amount: float
    category: str
    date: str
    status: str
    department_id: str
    receipt_filename: Optional[str] = None
    department: DepartmentInfo
