import { apiFetch } from "./auth";
import type { Currency } from "./currency";
import type { ReimbursementWithDepartment } from "./types";

export interface Batch {
  id: string; title: string; currency: Currency; status: string; created_at: string;
  shared?: boolean;
  items: (ReimbursementWithDepartment & { attachments?: { filename: string; filepath: string }[] })[];
  events: { action: string; operator: string; note: string; created_at: string }[];
  attachments?: { id: string; filename: string; filepath: string; uploaded_at: string }[];
}

export async function batchRequest(path = "", body?: unknown) {
  const response = await apiFetch(`/api/approval-batches${path}`, body ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  } : undefined);
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "操作失败，请检查输入");
  return data;
}

export async function shareBatch(id: string): Promise<{ share_token: string }> {
  const response = await apiFetch(`/api/approval-batches/${id}/share`, { method: "POST", headers: { "Content-Type": "application/json" } });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "分享失败");
  return data;
}

export async function unshareBatch(id: string): Promise<{ message: string }> {
  const response = await apiFetch(`/api/approval-batches/${id}/share`, { method: "DELETE" });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "取消分享失败");
  return data;
}

export async function uploadBatchAttachment(batchId: string, file: File): Promise<{ id: string; batch_id: string; filename: string; filepath: string; uploaded_at: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiFetch(`/api/approval-batches/${batchId}/attachments`, { method: "POST", body: formData });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "附件上传失败");
  return data;
}
