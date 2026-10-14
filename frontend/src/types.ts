export interface Department {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Reimbursement {
  id: string;
  desc: string;
  amount: number;
  category: string;
  date: string;
  status: "已报销" | "待审批" | "驳回" | "已报废";
  void_reason?: string | null;
  void_operator?: string | null;
  void_at?: string | null;
  department_id: string;
  receipt_filename?: string | null;
}

export interface ReimbursementWithDepartment extends Reimbursement {
  attachments?: { filename: string; filepath: string }[];
  department: Department;
}

export interface SummaryStats {
  totalCount: number;
  totalAmount: number;
  pendingCount: number;
}

export interface DepartmentStats {
  department_id: string;
  totalCount: number;
  totalAmount: number;
  pendingCount: number;
}

export interface ReceiptImage {
  id: string;
  reimbursement_id: string;
  filename: string;
  filepath: string;
  uploaded_at: string;
}

export interface UploadedFile {
  filename: string;
  stored_filename: string;
  filepath: string;
  uploaded_at: string;
}
