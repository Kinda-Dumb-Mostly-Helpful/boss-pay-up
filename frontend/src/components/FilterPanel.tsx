import { useTranslation } from "../i18n";
import { useRef, useState } from "react";
import type { Department } from "../types";
import { emptyDetailFilters } from "../detailFilters";
import type { DetailFilters } from "../detailFilters";
import { useCurrency } from "../currency";
interface Props {
  searchKeyword: string; selectedDepartmentId: string; departments: Department[]; advanced: DetailFilters;
  onApply: (keyword: string, department: string, advanced: DetailFilters) => void;
  showDepartmentManager: boolean; setShowDepartmentManager: (value: boolean) => void; handleClearSearch: () => void;
}
export default function FilterPanel(props: Props) {
  const t = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const currency = useCurrency();
  const [keyword, setKeyword] = useState("");
  const [department, setDepartment] = useState("");
  const [draft, setDraft] = useState<DetailFilters>(emptyDetailFilters);
  const [error, setError] = useState("");
  const set = (key: keyof DetailFilters, value: string) => setDraft(previous => ({ ...previous, [key]: value }));
  const tags = [props.searchKeyword && `${t("关键词")}：${props.searchKeyword}`, props.selectedDepartmentId && (props.departments.find(item => item.id === props.selectedDepartmentId)?.name || t("所选部门")),
    (props.advanced.from || props.advanced.to) && `${props.advanced.from || t("不限")} ${t("至")} ${props.advanced.to || t("不限")}`,
    (props.advanced.min || props.advanced.max) && `${currency} ${props.advanced.min || "0"}–${props.advanced.max || t("不限")}`, t(props.advanced.category)].filter(Boolean);
  function open() { setKeyword(props.searchKeyword); setDepartment(props.selectedDepartmentId); setDraft({ ...props.advanced }); setError(""); dialog.current?.showModal(); }
  return <div className="filter-launchbar">
    <button className={`filter-launch ${tags.length ? "has-filters" : ""}`} type="button" title={tags.length ? tags.join("；") : t("设置筛选条件")} onClick={open}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 5h16l-6 7v6l-4 2v-8z" /></svg>{t("筛选")}{tags.length > 0 && <b>{tags.length}</b>}
    </button>
    <div className="active-filter-tags">{tags.length ? tags.map((tag, index) => <span key={index} title={String(tag)}>{tag}</span>) : <small>{t("按关键词、日期、部门等筛选")}</small>}</div>
    {tags.length > 0 && <button className="filter-text-button" onClick={props.handleClearSearch}>{t("清除")}</button>}
    <button type="button" className={`department-manage-button ${props.showDepartmentManager ? "is-active" : ""}`} aria-expanded={props.showDepartmentManager} title={props.showDepartmentManager ? t("收起部门管理") : t("管理部门")} onClick={() => props.setShowDepartmentManager(!props.showDepartmentManager)}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="3" width="8" height="5" rx="1.5" /><path d="M12 8v5M5 16v-3h14v3" /><rect x="2" y="16" width="6" height="5" rx="1.5" /><rect x="16" y="16" width="6" height="5" rx="1.5" /></svg>
      <span>{t("管理部门")}</span>
      <svg className="department-manage-chevron" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
    </button>
    <dialog ref={dialog} className="detail-filter-dialog" aria-labelledby="detail-filter-title">
      <form onSubmit={event => {
        event.preventDefault();
        if (draft.from && draft.to && draft.from > draft.to) { setError("开始日期不能晚于结束日期"); return; }
        if ([draft.min, draft.max].some(value => value && (!Number.isFinite(Number(value)) || Number(value) < 0))) { setError("金额必须为非负数字"); return; }
        if (draft.min && draft.max && Number(draft.min) > Number(draft.max)) { setError("最低金额不能大于最高金额"); return; }
        props.onApply(keyword.trim(), department, draft); dialog.current?.close();
      }}>
        <header className="filter-dialog-heading"><div><h2 id="detail-filter-title">{t("筛选报销明细")}</h2><p>{t("组合条件，快速找到需要的记录")}</p></div><button type="button" aria-label={t("关闭筛选")} onClick={() => dialog.current?.close()}>×</button></header>
        <div className="filter-dialog-fields">
          <label className="filter-full">{t("关键词")}<input autoFocus value={keyword} onChange={event => setKeyword(event.target.value)} placeholder={t("搜索事由、类别、状态或金额")} /></label>
          <label>{t("部门")}<select value={department} onChange={event => setDepartment(event.target.value)}><option value="">{t("全部部门")}</option>{props.departments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>{t("费用类别")}<select value={draft.category} onChange={event => set("category", event.target.value)}><option value="">{t("全部类别")}</option>{["交通", "餐饮", "办公用品", "住宿", "其他"].map(value => <option key={value} value={value}>{t(value)}</option>)}</select></label>
          <div className="filter-full filter-section-label">{t("报销日期")}<span>{t("含开始及结束当天")}</span></div>
          <label>{t("开始日期")}<input type="date" value={draft.from} onChange={event => set("from", event.target.value)} /></label>
          <label>{t("结束日期")}<input type="date" value={draft.to} onChange={event => set("to", event.target.value)} /></label>
          <div className="filter-full filter-section-label">{t("金额范围")}<span>{currency}</span></div>
          <label>{t("最低金额")}<input type="number" min="0" step="0.01" placeholder={t("不限")} value={draft.min} onChange={event => set("min", event.target.value)} /></label>
          <label>{t("最高金额")}<input type="number" min="0" step="0.01" placeholder={t("不限")} value={draft.max} onChange={event => set("max", event.target.value)} /></label>
          {error && <p className="field-error filter-full" role="alert">{t(error)}</p>}
        </div>
        <footer className="filter-dialog-footer"><button type="button" className="filter-reset" onClick={() => { setKeyword(""); setDepartment(""); setDraft({ ...emptyDetailFilters }); setError(""); }}>{t("重置条件")}</button><button type="button" onClick={() => dialog.current?.close()}>{t("取消")}</button><button className="filter-apply" type="submit">{t("应用筛选")}</button></footer>
      </form>
    </dialog>
  </div>;
}
