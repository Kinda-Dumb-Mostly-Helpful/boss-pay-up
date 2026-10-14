import { useTranslation } from "../i18n";
import React, { useEffect, useState } from "react";
import { batchRequest } from "../batchApi";
import type { Batch } from "../batchApi";
import { useLoginUser } from "../auth";
import type { ReimbursementWithDepartment, Department } from "../types";
import { useCurrency } from "../currency";
import { downloadExcel, printApplication, selectedTotal } from "../reimbursementExport";

const statusTabs = ["全部", "待审批", "已报销", "驳回", "已报废"] as const;
const pageSizes = [10, 20, 50, 100];
interface PaginationPreferences { size: number; pages: Record<string, number>; }
function readPagination(key: string): PaginationPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return { size: pageSizes.includes(value?.size) ? value.size : 10,
      pages: value?.pages && typeof value.pages === "object" && !Array.isArray(value.pages) ? value.pages : {} };
  } catch { return { size: 10, pages: {} }; }
}

interface ReimbursementTableProps {
  filters: React.ReactNode;
  reimbursements: ReimbursementWithDepartment[];
  departments: Department[];
  selectedDepartmentId: string;
  totalCount: number;
  handleEdit: (id: string) => void;
  handleDelete: (id: string) => void;
  editingId: string | null;
  hasActiveFilter: boolean;
  savingForm: boolean;
  onBatchChanged: () => Promise<void>;
  searchKeyword: string;
}

const ReimbursementTable: React.FC<ReimbursementTableProps> = ({
  filters,
  reimbursements,
  departments,
  selectedDepartmentId,
  totalCount,
  handleEdit,
  handleDelete,
  editingId,
  hasActiveFilter,
  savingForm,
  onBatchChanged,
  searchKeyword,
}) => {
  const t = useTranslation();
  const currency = useCurrency();
  const user = useLoginUser();
  const cacheKey = `reimbursement-pagination:${user?.id || "local"}`;
  const [pagination, setPagination] = useState(() => readPagination(cacheKey));
  const [statusTab, setStatusTab] = useState<(typeof statusTabs)[number]>("全部");
  const visibleItems = reimbursements.filter(item => statusTab === "全部" || item.status === statusTab);
  const filterKey = JSON.stringify([selectedDepartmentId, searchKeyword, statusTab]);
  const pageCount = Math.max(1, Math.ceil(visibleItems.length / pagination.size));
  const savedPage = pagination.pages[filterKey];
  const page = Math.min(pageCount, Number.isSafeInteger(savedPage) && savedPage > 0 ? savedPage : 1);
  const pageItems = visibleItems.slice((page - 1) * pagination.size, page * pagination.size);
  function updatePagination(nextPage: number, size = pagination.size) {
    const next = { size, pages: size === pagination.size ? { ...pagination.pages, [filterKey]: nextPage } : { [filterKey]: 1 } };
    setPagination(next);
    try { localStorage.setItem(cacheKey, JSON.stringify(next)); } catch { /* Pagination works even if storage is unavailable. */ }
  }
  function changeTab(value: (typeof statusTabs)[number]) {
    setStatusTab(value);
    setSelectedIds(new Set());
  }
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [batchReady, setBatchReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [batchMessage, setBatchMessage] = useState("");
  async function refreshActiveIds() {
    const batches: Batch[] = await batchRequest();
    setActiveIds(batches.filter(batch => batch.status !== "已驳回").flatMap(batch => batch.items.map(item => item.id)));
    setBatchReady(true);
  }
  useEffect(() => {
    refreshActiveIds().catch(error => setExportError(error.message));
  }, []);
  const eligible = visibleItems.filter(item => batchReady && item.status === "待审批" && !activeIds.includes(item.id));
  const selected = eligible.filter(item => selectedIds.has(item.id));
  const pageEligible = eligible.filter(item => pageItems.some(row => row.id === item.id));
  const pageSelectedCount = pageEligible.filter(item => selectedIds.has(item.id)).length;
  const allSelected = pageEligible.length > 0 && pageSelectedCount === pageEligible.length;
  function togglePage() {
    setSelectedIds(previous => {
      const next = new Set(previous);
      pageEligible.forEach(item => { if (allSelected) next.delete(item.id); else next.add(item.id); });
      return next;
    });
  }
  async function submitBatch() {
    if (submitting || savingForm || !selected.length) return;
    setSubmitting(true); setExportError(""); setBatchMessage("");
    try {
      await batchRequest("", { ids: selected.map(item => item.id), currency });
      setActiveIds(previous => [...previous, ...selected.map(item => item.id)]);
      setSelectedIds(new Set());
      setBatchMessage("审批组已创建，前往“审批组与历史档案”处理。");
      await onBatchChanged();
    } catch (error) { setExportError(error instanceof Error ? error.message : "提交失败"); }
    finally { setSubmitting(false); }
  }
  function toggle(id: string) {
    setSelectedIds(previous => {
      const next = new Set(reimbursements.filter(item => previous.has(item.id)).map(item => item.id));
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  async function exportSelection(format: "excel" | "print") {
    if (!selected.length || exporting) return;
    setExportError("");
    setExporting(true);
    try {
      if (format === "excel") await downloadExcel(selected, currency);
      else printApplication(selected, currency);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "导出失败，请重试");
    } finally { setExporting(false); }
  }
  return (
    <div className="table-wrapper">
      <div className="table-header">
        <h2>
          {t("📌 报销明细表")}<span className="badge">{visibleItems.length} / {totalCount} {t("项")}</span>
          {selectedDepartmentId && (
            <span className="department-badge">
              {t("部门:")}{" "}
              {departments.find((d) => d.id === selectedDepartmentId)?.name ||
                "未知"}
            </span>
          )}
        </h2>
      </div>

      <div className="table-filter-row">
      <div className="status-tabs" role="tablist" aria-label={t("按报销状态分类")}>
        {statusTabs.map((tab, index) => <button
          key={t(tab)} type="button" role="tab" id={`status-tab-${index}`}
          aria-selected={statusTab === tab} aria-controls="reimbursement-status-panel"
          tabIndex={statusTab === tab ? 0 : -1} disabled={submitting || exporting}
          onClick={() => changeTab(tab)}
          onKeyDown={event => {
            const next = event.key === "ArrowRight" ? (index + 1) % statusTabs.length
              : event.key === "ArrowLeft" ? (index + statusTabs.length - 1) % statusTabs.length
              : event.key === "Home" ? 0 : event.key === "End" ? statusTabs.length - 1 : null;
            if (next === null) return;
            event.preventDefault(); changeTab(statusTabs[next]);
            document.getElementById(`status-tab-${next}`)?.focus();
          }}
        >{t(tab)}<span>{tab === "全部" ? reimbursements.length : reimbursements.filter(item => item.status === tab).length}</span></button>)}
      </div>
      <div className="table-filters">{filters}</div>
      </div>
      <div className="export-toolbar">
        <div aria-live="polite">{t("已选")}: <strong>{selected.length}</strong> {t("项 · 合计")}: <strong>{currency} {selectedTotal(selected).toFixed(2)}</strong><small title={t("支持跨页勾选；全选仅选当前页，导出包含当前筛选下各页已选明细")}>{t("可跨页选择 · 全选仅当前页")}</small></div>
        <div className="export-actions">
          <button className="batch-submit" type="button" disabled={!selected.length || submitting || savingForm || exporting} onClick={submitBatch}>{submitting ? t("提交中…") : `${t("一键提交审批")} (${selected.length})`}</button>
          <button type="button" onClick={() => setSelectedIds(new Set())} disabled={!selected.length || exporting}>{t("清空选择")}</button>
          <button type="button" onClick={() => exportSelection("excel")} disabled={!selected.length || exporting}>{exporting ? t("处理中…") : t("导出 Excel")}</button>
          <button type="button" onClick={() => exportSelection("print")} disabled={!selected.length || exporting}>{t("打印 / 导出 PDF")}</button>
        </div>
      </div>
      {exportError && <p className="export-error" role="alert">{t(exportError)}</p>}
      {!batchReady && <button type="button" onClick={() => refreshActiveIds().catch(error => setExportError(error.message))}>{t("重新加载可审批明细")}</button>}
      {batchMessage && <p role="status" className="reimbursed-message">{t(batchMessage)} <a href="#/approvals">{t("查看审批组")}</a></p>}
      <div id="reimbursement-status-panel" className="detail-table-scroll" role="tabpanel" tabIndex={0} aria-labelledby={`status-tab-${statusTabs.indexOf(statusTab)}`}>
        <table>
          <thead>
            <tr>
              <th className="selection-cell"><input type="checkbox" aria-label={t("全选当前页可审批明细")} checked={allSelected} disabled={!pageEligible.length || exporting || submitting} ref={element => { if (element) element.indeterminate = pageSelectedCount > 0 && !allSelected; }} onChange={togglePage} /></th>
              <th>{t("描述")}</th>
              <th>{t("金额 (")}{currency})</th>
              <th>{t("类别")}</th>
              <th>{t("部门")}</th>
              <th>{t("日期")}</th>
              <th>{t("状态")}</th>
              <th>{t("附件图")}</th>
              <th style={{ textAlign: "center" }}>{t("操作")}</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={9}>
                  {statusTab !== "全部" ? `${t("暂无匹配记录")} · ${t(statusTab)}` : hasActiveFilter
                    ? t("📭 没有匹配的报销记录 — 试试添加或清除筛选")
                    : t("📭 暂无报销记录 — 点击上方添加记录")}
                </td>
              </tr>
            ) : (
              pageItems.map((item) => (
                <tr key={item.id} className={editingId === item.id ? "active-row" : ""}>
                  <td className="selection-cell"><input type="checkbox" aria-label={`选择报销：${item.desc}`} title={item.status !== "待审批" ? t("只能选择待审批明细") : activeIds.includes(item.id) ? t("已归入审批组") : t("选择待审批明细")} checked={selected.some(row => row.id === item.id)} disabled={exporting || item.status !== "待审批" || activeIds.includes(item.id)} onChange={() => toggle(item.id)} /></td>
                  <td>
                    <span style={{ fontWeight: 500 }}>{item.desc}</span>
                  </td>
                  <td className="money">{currency} {item.amount.toFixed(2)}</td>
                  <td>
                    <span className="highlight-category">{t(item.category)}</span>
                  </td>
                  <td>
                    <span className="department-tag">
                      {item.department?.name || "未知"}
                    </span>
                  </td>
                  <td>{item.date}</td>
                  <td>
                    <span
                      className={`status-badge ${
                        item.status === "待审批" ? "pending" : ""
                      }`}
                    >
                      {t(item.status)}
                    </span>
                    {item.void_reason && <div className="void-details">{t("原因：")}{item.void_reason}<br />{t("报废人：")}{item.void_operator}<br />{item.void_at}</div>}
                  </td>
                  <td>
                    {/* Show receipt filename if exists */}
                    {item.receipt_filename ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <a
                          href={`/api/upload/${item.receipt_filename}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={item.receipt_filename}
                          style={{
                            maxWidth: "120px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: "#0066cc",
                            textDecoration: "none",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.textDecoration = "underline")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.textDecoration = "none")
                          }
                        >
                          📄 {item.receipt_filename}
                        </a>
                        <button
                          type="button"
                          onClick={() => handleEdit(item.id)}
                          title={t("查看/上传图片")}
                          disabled={savingForm || item.status === "已报销" || item.status === "已报废"}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "1.2rem",
                          }}
                        >
                          📷
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleEdit(item.id)}
                        title={t("上传图片")}
                        disabled={savingForm || item.status === "已报销" || item.status === "已报废"}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "1.2rem",
                        }}
                      >
                        📷
                      </button>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div className="action-icons">

                      <button
                        title={t("编辑明细")}
                        disabled={savingForm || item.status === "已报销" || item.status === "已报废" || activeIds.includes(item.id)}
                        aria-label={`编辑明细：${item.desc}`}
                        className="edit-btn"
                        onClick={() => handleEdit(item.id)}
                      >
                        ✏️
                      </button>
                      <button
                        title={t("报废（需填写原因）")}
                        aria-label={`报废明细：${item.desc}（需填写原因）`}
                        disabled={savingForm || item.status === "已报销" || item.status === "已报废" || activeIds.includes(item.id)}
                        className="delete-btn"
                        onClick={() => handleDelete(item.id)}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="9" />
                          <path d="m5.6 5.6 12.8 12.8" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <nav className="pagination-bar" aria-label={t("明细分页")}>
        <span aria-live="polite">{t("共")}{visibleItems.length} {t("条 · 第")}{visibleItems.length ? (page - 1) * pagination.size + 1 : 0}–{Math.min(page * pagination.size, visibleItems.length)} {t("条")}</span>
        <label>{t("每页")}<select value={pagination.size} disabled={submitting || exporting} onChange={event => updatePagination(1, Number(event.target.value))}>
          {pageSizes.map(size => <option key={size} value={size}>{size} {t("条")}</option>)}
        </select></label>
        <button type="button" disabled={page === 1 || submitting || exporting} onClick={() => updatePagination(1)}>{t("首页")}</button>
        <button type="button" disabled={page === 1 || submitting || exporting} onClick={() => updatePagination(page - 1)}>{t("上一页")}</button>
        <label>{t("页码")}<select aria-label={t("跳转页码")} value={page} disabled={!visibleItems.length || submitting || exporting} onChange={event => updatePagination(Number(event.target.value))}>
          {Array.from({ length: pageCount }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
        </select> / {pageCount}</label>
        <button type="button" disabled={page === pageCount || submitting || exporting} onClick={() => updatePagination(page + 1)}>{t("下一页")}</button>
        <button type="button" disabled={page === pageCount || submitting || exporting} onClick={() => updatePagination(pageCount)}>{t("末页")}</button>
      </nav>
    </div>
  );
};

export default ReimbursementTable;
