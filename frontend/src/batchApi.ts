import { apiFetch } from "./auth";
import type { Currency } from "./currency";
import type { ReimbursementWithDepartment } from "./types";

export interface Batch {
  id: string; title: string; currency: Currency; status: string; created_at: string;
  items: (ReimbursementWithDepartment & { attachments?: { filename: string; filepath: string }[] })[];
  events: { action: string; operator: string; note: string; created_at: string }[];
}

export async function batchRequest(path = "", body?: unknown) {
  const response = await apiFetch(`/api/approval-batches${path}`, body ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  } : undefined);
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "操作失败，请检查输入");
  return data;
}
