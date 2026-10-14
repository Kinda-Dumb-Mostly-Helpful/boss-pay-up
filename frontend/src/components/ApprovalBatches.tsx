import AttachmentPreview from "./AttachmentPreview";
import { useTranslation } from "../i18n";
import { batchRequest as request, shareBatch, unshareBatch, uploadBatchAttachment } from "../batchApi";
import type { Batch } from "../batchApi";
import { useEffect, useState } from "react";
import { useLoginUser } from "../auth";
import { printApplication, selectedTotal } from "../reimbursementExport";
import PendingAttachment from "./PendingAttachment";

const archiveStatuses = ["全部", "待审批", "已批准", "已报销", "已驳回"];
const statusStyle = (status: string) => ({ "待审批": "pending", "已批准": "approved", "已报销": "paid", "已驳回": "rejected" })[status] || "";
const formatAmount = (value: number) => value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ApprovalBatches({ onChanged, disabled }: {
  onChanged: () => Promise<void>; disabled: boolean;
}) {
  const t = useTranslation();
  const [batches, setBatches] = useState<Batch[]>([]);
  const operator = useLoginUser()?.display_name || "";
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("全部");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [pendingFiles, setPendingFiles] = useState<Record<string, File[]>>({});
  const [draggingBatch, setDraggingBatch] = useState<string | null>(null);
  async function refresh() {
    setLoading(true);
    try {
      const data: Batch[] = await request();
      setBatches(data);
    } finally { setLoading(false); }
  }
  useEffect(() => { refresh().catch(error => setError(error.message)); }, []);
  async function submit(batch: Batch, action: string) {
    if (busy || disabled) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const files = pendingFiles[batch.id] || [];
      for (const file of files) await uploadBatchAttachment(batch.id, file);
      if (files.length) setPendingFiles(previous => ({ ...previous, [batch.id]: [] }));
      await request(`/${batch.id}/actions`, { action, note: notes[batch.id] || "" });
      setNotes(previous => ({ ...previous, [batch.id]: "" }));
      setMessage("操作已保存并留档");
      await refresh();
      await onChanged();
    } catch (error) { setError(error instanceof Error ? error.message : "操作失败"); }
    finally { setBusy(false); }
  }
  function addAttachmentFiles(batch: Batch, files: File[]) {
    if (!files.length) return;
    setPendingFiles(previous => ({ ...previous, [batch.id]: [...(previous[batch.id] || []), ...files] }));
  }
  async function uploadAttachments(batch: Batch) {
    const files = pendingFiles[batch.id] || [];
    if (!files.length || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      for (const file of files) await uploadBatchAttachment(batch.id, file);
      setPendingFiles(previous => ({ ...previous, [batch.id]: [] }));
      setMessage("附件上传成功");
      await refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "附件上传失败"); }
    finally { setBusy(false); }
  }
  async function copyShareLink(batch: Batch) {
    if (shareBusy) return;
    setShareBusy(true); setError(""); setShareMessage("");
    try {
      const { share_token } = await shareBatch(batch.id);
      const url = `${window.location.origin}${window.location.pathname}#/share/${share_token}`;
      try { await navigator.clipboard.writeText(url); setShareMessage(t("分享链接已复制")); }
      catch { setShareMessage(t("分享链接：") + url); }
      await refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "分享失败"); }
    finally { setShareBusy(false); }
  }
  async function stopSharing(batch: Batch) {
    if (shareBusy) return;
    setShareBusy(true); setError(""); setShareMessage("");
    try {
      await unshareBatch(batch.id);
      setShareMessage(t("已停止分享"));
      await refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "取消分享失败"); }
    finally { setShareBusy(false); }
  }
  const filtered = batches.filter(batch => (status === "全部" || batch.status === status) && `${batch.title} ${batch.id} ${batch.events[0]?.operator || ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="batch-panel archive-workspace">
    <div className="archive-heading"><div><h2>{t("审批组与历史档案")}</h2><p>{t("按批处理报销，完整保留每一次审批记录。")}</p></div><a href="#/reimbursements">{t("← 返回报销明细")}</a></div>
    <div className="archive-filterbar">
      <div className="archive-status-filters" aria-label={t("审批状态筛选")}>{archiveStatuses.map(value => <button key={value} aria-pressed={status === value} onClick={() => setStatus(value)}>{t(value)}<span>{value === "全部" ? batches.length : batches.filter(batch => batch.status === value).length}</span></button>)}</div>
      <div className="archive-search"><input aria-label={t("搜索审批组")} placeholder={t("搜索组名、编号、提交人")} value={query} onChange={event => setQuery(event.target.value)} /><button disabled={busy || loading} onClick={() => refresh().catch(error => setError(error.message))}>{loading ? t("加载中…") : t("刷新")}</button></div>
    </div>
    {error && <p role="alert" className="export-error">{t(error)}</p>}
    {message && <p role="status" className="reimbursed-message">{t(message)}</p>}
    {shareMessage && <p role="status" className="reimbursed-message">{shareMessage}</p>}
    {!filtered.length && <div className="archive-empty">{loading ? t("正在加载审批档案…") : batches.length ? t("没有符合筛选条件的审批组") : t("暂无审批档案")}<small>{t("在报销明细页选择待审批记录，提交后将在这里生成档案。")}</small></div>}
    {filtered.map(batch => <details key={batch.id} className={`batch-archive archive-card archive-card-${statusStyle(batch.status)}`}>
      <summary><span className={`archive-state ${statusStyle(batch.status)}`}>{t(batch.status)}</span><div className="archive-card-title"><strong>{batch.title}</strong><small>{batch.created_at.replace("T", " ")} · {batch.events[0]?.operator || "—"} · {batch.items.length} {t("项明细")}</small></div><span className="archive-amount"><small>{batch.currency}</small> {formatAmount(selectedTotal(batch.items))}</span><span className="archive-chevron" aria-hidden="true">⌄</span></summary>
      <div className="archive-card-body">
      <p className="archive-id">{t("批次编号：")}{batch.id}</p>
      <div className="archive-review-row">
        {(batch.status === "待审批" || batch.status === "已批准") && <label className="archive-note">{t("审批意见 / 经办备注")}<input value={notes[batch.id] || ""} maxLength={1000} disabled={busy} onChange={event => setNotes(previous => ({ ...previous, [batch.id]: event.target.value }))} placeholder={t("填写本批次的审批意见或付款说明（选填）")} /></label>}
      <div className="form-section archive-attachment-section">
        <div className="attachment-heading"><h4>{t("留档附件")}</h4><span>{t("支持 PDF、图片等任意文件")}</span></div>
        <div className={`attachment-dropzone ${draggingBatch === batch.id ? "is-dragging" : ""} ${busy ? "is-disabled" : ""}`}
          onDragOver={event => { event.preventDefault(); if (!busy) setDraggingBatch(batch.id); }}
          onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDraggingBatch(null); }}
          onDrop={event => { event.preventDefault(); setDraggingBatch(null); addAttachmentFiles(batch, Array.from(event.dataTransfer.files)); }}>
          <label htmlFor={`archive-upload-${batch.id}`} className="attachment-upload-label">
            <span className="attachment-upload-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V3m-4 4 4-4 4 4M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" /></svg></span>
            <span><strong>{t("点击选择或拖入文件")}</strong><small>{t("可多次添加，点“上传留档附件”统一上传")}</small></span>
          </label>
          <input id={`archive-upload-${batch.id}`} className="attachment-file-input" type="file" multiple disabled={busy} onChange={event => { addAttachmentFiles(batch, Array.from(event.target.files || [])); event.target.value = ""; }} />
        </div>
        {pendingFiles[batch.id]?.length ? <>
          <div className="attachment-list-heading"><span>{t("待上传")}<b>{pendingFiles[batch.id].length}</b></span><button type="button" disabled={busy} onClick={() => setPendingFiles(previous => ({ ...previous, [batch.id]: [] }))}>{t("清空")}</button></div>
          <div className="attachment-grid">
            {pendingFiles[batch.id].map((file, index) => <PendingAttachment key={`${file.name}-${file.lastModified}-${index}`} file={file} disabled={busy} onRemove={() => setPendingFiles(previous => ({ ...previous, [batch.id]: (previous[batch.id] || []).filter((_, position) => position !== index) }))} />)}
          </div>
          <div className="export-actions" style={{ marginTop: 10 }}>
            <button type="button" onClick={() => uploadAttachments(batch)} disabled={busy || shareBusy}>{t("上传留档附件")} ({pendingFiles[batch.id].length})</button>
          </div>
        </> : null}
        {batch.attachments?.length ? <>
          <div className="attachment-list-heading"><span>{t("已上传")}<b>{batch.attachments.length}</b></span></div>
          <div className="attachment-grid archive-attachment-grid">
            {batch.attachments.map(attachment => {
              const stored = attachment.filepath.split(/[\\/]/).pop() || "";
              const isImage = /\.(png|jpe?g|gif|bmp|webp)$/i.test(stored);
              return <a key={attachment.id} className="attachment-card archive-attachment-card" target="_blank" rel="noopener noreferrer" href={`/api/upload/${encodeURIComponent(stored)}`}>
                {isImage
                  ? <img src={`/api/upload/${encodeURIComponent(stored)}`} alt={attachment.filename} loading="lazy" />
                  : <span className="archive-attachment-file"><span aria-hidden="true">📄</span><small>{stored.split(".").pop()}</small></span>}
                <div className="attachment-caption"><span title={attachment.filename}>{attachment.filename}</span><small>{attachment.uploaded_at?.replace("T", " ").slice(0, 16)}</small></div>
              </a>;
            })}
          </div>
        </> : null}
      </div>
      <div className="archive-actionbar">
      <div className="export-actions">
        {batch.status === "待审批" && <>
          <button className="archive-primary" disabled={busy || disabled || !operator.trim()} onClick={() => submit(batch, "approve")}>{t("批准该批次")}</button>
          <button className="archive-reject" disabled={busy || disabled || !operator.trim()} onClick={() => submit(batch, "reject")}>{t("驳回该批次")}</button>
        </>}
        {batch.status === "已批准" && <button className="archive-primary" disabled={busy || disabled || !operator.trim()} onClick={() => submit(batch, "reimburse")}>{t("整批一键已报销")}</button>}
        <button onClick={() => { try { printApplication(batch.items, batch.currency); } catch (error) { setError(String(error)); } }}>{t("打印归档明细 / PDF")}</button>
        <button onClick={() => copyShareLink(batch)} disabled={shareBusy} title={t("生成公开查看链接，任何人都可通过该链接查看此审批组")}>{batch.shared ? t("复制分享链接") : t("分享")}</button>
        {batch.shared && <button onClick={() => stopSharing(batch)} disabled={shareBusy}>{t("停止分享")}</button>}
      </div>
      </div>
      </div>
      <div className="archive-detail-table" style={{ overflowX: "auto" }}><table><thead><tr><th>{t("事由")}</th><th>{t("部门")}</th><th>{t("日期")}</th><th>{t("类别")}</th><th>{t("金额（")}{batch.currency}）</th><th>{t("附件图")}</th></tr></thead><tbody>
        {batch.items.map(item => <tr key={item.id}><td>{item.desc}</td><td>{item.department.name}</td><td>{item.date}</td><td>{t(item.category)}</td><td>{item.amount.toFixed(2)}</td><td>
          {item.attachments?.map(attachment => <span key={attachment.filepath}><AttachmentPreview name={attachment.filename} src={`/api/upload/${encodeURIComponent(attachment.filepath.split(/[\\/]/).pop() || "")}`} /></span>)}
          {!item.attachments?.length && (item.receipt_filename ? <AttachmentPreview name={item.receipt_filename} src={`/api/upload/${encodeURIComponent(item.receipt_filename)}`} /> : t("无附件"))}
        </td></tr>)}
      </tbody></table></div>
      <h4 className="archive-history-title">{t("审批处理记录")}</h4>
      <ol className="archive-timeline">{batch.events.map((event, index) => <li key={index}><div><strong>{t(event.action)}</strong><span>{event.operator}</span><time>{event.created_at.replace("T", " ")}</time></div>{event.note && <p>{event.note}</p>}</li>)}</ol>
      </div>
    </details>)}
  </section>;
}
