import { useTranslation } from "../i18n";
import { batchRequest as request } from "../batchApi";
import type { Batch } from "../batchApi";
import { useEffect, useState } from "react";
import { useLoginUser } from "../auth";
import { printApplication, selectedTotal } from "../reimbursementExport";

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
      await request(`/${batch.id}/actions`, { action, note: notes[batch.id] || "" });
      setNotes(previous => ({ ...previous, [batch.id]: "" }));
      setMessage("操作已保存并留档");
      await refresh();
      await onChanged();
    } catch (error) { setError(error instanceof Error ? error.message : "操作失败"); }
    finally { setBusy(false); }
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
    {!filtered.length && <div className="archive-empty">{loading ? t("正在加载审批档案…") : batches.length ? t("没有符合筛选条件的审批组") : t("暂无审批档案")}<small>{t("在报销明细页选择待审批记录，提交后将在这里生成档案。")}</small></div>}
    {filtered.map(batch => <details key={batch.id} className="batch-archive archive-card">
      <summary><span className={`archive-state ${statusStyle(batch.status)}`}>{t(batch.status)}</span><div className="archive-card-title"><strong>{batch.title}</strong><small>{batch.created_at.replace("T", " ")} · {batch.events[0]?.operator || "—"} · {batch.items.length} {t("项明细")}</small></div><span className="archive-amount"><small>{batch.currency}</small> {formatAmount(selectedTotal(batch.items))}</span><span className="archive-chevron" aria-hidden="true">⌄</span></summary>
      <div className="archive-card-body">
      <p className="archive-id">{t("批次编号：")}{batch.id}</p>
      <div className="archive-actionbar">
        {(batch.status === "待审批" || batch.status === "已批准") && <label className="archive-note">{t("审批意见 / 经办备注")}<input value={notes[batch.id] || ""} maxLength={1000} disabled={busy} onChange={event => setNotes(previous => ({ ...previous, [batch.id]: event.target.value }))} placeholder={t("填写本批次的审批意见或付款说明（选填）")} /></label>}
      <div className="export-actions">
        {batch.status === "待审批" && <>
          <button className="archive-primary" disabled={busy || disabled || !operator.trim()} onClick={() => submit(batch, "approve")}>{t("批准该批次")}</button>
          <button className="archive-reject" disabled={busy || disabled || !operator.trim()} onClick={() => submit(batch, "reject")}>{t("驳回该批次")}</button>
        </>}
        {batch.status === "已批准" && <button className="archive-primary" disabled={busy || disabled || !operator.trim()} onClick={() => submit(batch, "reimburse")}>{t("整批一键已报销")}</button>}
        <button onClick={() => { try { printApplication(batch.items, batch.currency); } catch (error) { setError(String(error)); } }}>{t("打印归档明细 / PDF")}</button>
      </div>
      </div>
      <div className="archive-detail-table" style={{ overflowX: "auto" }}><table><thead><tr><th>{t("事由")}</th><th>{t("部门")}</th><th>{t("日期")}</th><th>{t("类别")}</th><th>{t("金额（")}{batch.currency}）</th><th>{t("附件图")}</th></tr></thead><tbody>
        {batch.items.map(item => <tr key={item.id}><td>{item.desc}</td><td>{item.department.name}</td><td>{item.date}</td><td>{t(item.category)}</td><td>{item.amount.toFixed(2)}</td><td>
          {item.attachments?.map(attachment => <div key={attachment.filepath}><a target="_blank" rel="noopener noreferrer" href={`/api/upload/${encodeURIComponent(attachment.filepath.split(/[\\/]/).pop() || "")}`}>{attachment.filename}</a></div>)}
          {!item.attachments?.length && (item.receipt_filename ? <a target="_blank" rel="noopener noreferrer" href={`/api/upload/${encodeURIComponent(item.receipt_filename)}`}>{t("查看收据")}</a> : t("无附件"))}
        </td></tr>)}
      </tbody></table></div>
      <h4 className="archive-history-title">{t("审批处理记录")}</h4>
      <ol className="archive-timeline">{batch.events.map((event, index) => <li key={index}><div><strong>{t(event.action)}</strong><span>{event.operator}</span><time>{event.created_at.replace("T", " ")}</time></div>{event.note && <p>{event.note}</p>}</li>)}</ol>
      </div>
    </details>)}
  </section>;
}
