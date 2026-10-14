import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Batch } from "../batchApi";
import type { ReimbursementWithDepartment } from "../types";
import { currencies } from "../currency";
import { selectedTotal } from "../reimbursementExport";

type Item = ReimbursementWithDepartment & { attachments?: { filename: string; filepath: string }[] };

const statusClass = (status: string) =>
  ({ "待审批": "pending", "已批准": "approved", "已报销": "paid", "已驳回": "rejected" })[status] || "";

const formatAmount = (value: number) =>
  value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="container" style={{ maxWidth: 960 }}>
      <header className="account-bar" style={{ justifyContent: "flex-start", marginBottom: 16 }}>
        <div className="system-brand">
          <span className="brand-mark" aria-hidden="true">打</span>
          <div>
            <h1>老板打钱</h1>
            <p>审批分享 · 公开查看</p>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

export default function PublicBatchView({ token }: { token: string }) {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/public/batches/${encodeURIComponent(token)}`);
        if (!response.ok) {
          setError(response.status === 404 ? "该审批组未公开分享，或分享链接已失效" : "加载失败，请稍后重试");
          return;
        }
        const data = await response.json();
        if (!cancelled) setBatch(data);
      } catch {
        setError("网络异常，请稍后重试");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const attachmentUrl = (filename: string) =>
    `/api/public/batches/${encodeURIComponent(token)}/attachments/${encodeURIComponent(filename)}`;

  const renderAttachments = (item: Item) => {
    const attachments = item.attachments?.filter(att => att?.filepath) ?? [];
    const links: ReactNode[] = [];
    attachments.forEach((att, index) => {
      if (index > 0) links.push(<span key={`sep-${att.filepath}`} style={{ color: "var(--text-soft)" }}> · </span>);
      links.push(
        <a key={att.filepath} target="_blank" rel="noopener noreferrer" href={attachmentUrl(att.filepath.split(/[\\/]/).pop() || "")}>
          {att.filename}
        </a>,
      );
    });
    if (links.length) return <>{links}</>;
    if (item.receipt_filename) {
      return <a target="_blank" rel="noopener noreferrer" href={attachmentUrl(item.receipt_filename)}>查看收据</a>;
    }
    return <span style={{ color: "var(--text-soft)" }}>无附件</span>;
  };

  if (loading) return <Shell><div className="archive-empty">加载中…</div></Shell>;
  if (error || !batch) return <Shell><div className="archive-empty">{error || "未找到内容"}</div></Shell>;

  const total = selectedTotal(batch.items);

  return (
    <Shell>
      <section className="archive-page archive-workspace" style={{ background: "var(--surface)" }}>
        <div className="archive-heading">
          <div>
            <h2>{batch.title}</h2>
            <p>批次编号：{batch.id} · 提交时间：{batch.created_at.replace("T", " ")}</p>
          </div>
          <span className={`archive-state ${statusClass(batch.status)}`}>{batch.status}</span>
        </div>

        <div className="summary-card" style={{ marginBottom: 16 }}>
          <div className="summary-item"><span className="label">明细项数</span><span className="value">{batch.items.length}</span></div>
          <div className="summary-item"><span className="label">币种</span><span className="value">{currencies[batch.currency] || batch.currency}（{batch.currency}）</span></div>
          <div className="summary-item"><span className="label">合计金额</span><span className="value"><small>{batch.currency}</small> {formatAmount(total)}</span></div>
        </div>

        <div className="archive-detail-table" style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>事由</th>
                <th>部门</th>
                <th>日期</th>
                <th>类别</th>
                <th>金额（{batch.currency}）</th>
                <th>附件</th>
              </tr>
            </thead>
            <tbody>
              {batch.items.map(item => (
                <tr key={item.id}>
                  <td>{item.desc}</td>
                  <td>{item.department?.name || "未知"}</td>
                  <td>{item.date}</td>
                  <td>{item.category}</td>
                  <td className="money">{item.amount.toFixed(2)}</td>
                  <td>{renderAttachments(item)}</td>
                </tr>
              ))}
              <tr style={{ background: "var(--surface-soft)", fontWeight: 600 }}>
                <td colSpan={4}>合计</td>
                <td className="money">{batch.currency} {formatAmount(total)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        <h4 className="archive-history-title">审批处理记录</h4>
        <ol className="archive-timeline">
          {batch.events.map((event, index) => (
            <li key={index}>
              <div><strong>{event.action}</strong><span>{event.operator}</span><time>{event.created_at.replace("T", " ")}</time></div>
              {event.note && <p>{event.note}</p>}
            </li>
          ))}
        </ol>

        {batch.attachments?.length ? (
          <>
            <h4 className="archive-history-title">留档附件<span className="archive-attachment-count">{batch.attachments.length}</span></h4>
            <div className="attachment-grid archive-attachment-grid">
              {batch.attachments.map(attachment => {
                const stored = attachment.filepath.split(/[\\/]/).pop() || "";
                const isImage = /\.(png|jpe?g|gif|bmp|webp)$/i.test(stored);
                return (
                  <a key={attachment.id} className="attachment-card archive-attachment-card" target="_blank" rel="noopener noreferrer" href={attachmentUrl(stored)}>
                    {isImage
                      ? <img src={attachmentUrl(stored)} alt={attachment.filename} loading="lazy" />
                      : <span className="archive-attachment-file"><span aria-hidden="true">📄</span><small>{stored.split(".").pop()}</small></span>}
                    <div className="attachment-caption"><span title={attachment.filename}>{attachment.filename}</span><small>{attachment.uploaded_at?.replace("T", " ").slice(0, 16)}</small></div>
                  </a>
                );
              })}
            </div>
          </>
        ) : null}

        <p className="archive-id" style={{ marginTop: 14 }}>此页面通过分享链接公开访问，无需登录。</p>
      </section>
    </Shell>
  );
}
