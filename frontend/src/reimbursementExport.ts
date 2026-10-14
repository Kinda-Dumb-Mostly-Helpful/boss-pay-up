import type { ReimbursementWithDepartment } from "./types";
import { currencies } from "./currency";
import type { Currency } from "./currency";
import { apiFetch } from "./auth";

export function selectedTotal(items: ReimbursementWithDepartment[]) {
  return items.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100;
}

export async function downloadExcel(items: ReimbursementWithDepartment[], currency: Currency) {
  const response = await apiFetch("/api/exports/reimbursements.xlsx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: items.map(item => item.id), currency }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(typeof error?.detail === "string" ? error.detail : "Excel 导出失败，请稍后重试");
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `报销申请单-${new Date().toLocaleDateString("sv-SE")}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function printApplication(items: ReimbursementWithDepartment[], currency: Currency) {
  if (!items.length) throw new Error("请先选择需要导出的报销明细");
  const dialog = document.createElement("dialog");
  dialog.className = "print-preview-dialog";
  dialog.setAttribute("aria-label", "报销申请单打印预览");
  const toolbar = document.createElement("div");
  toolbar.className = "print-preview-toolbar";
  const message = document.createElement("p");
  message.textContent = "正在加载预览…";
  message.setAttribute("role", "status");
  const printButton = document.createElement("button");
  printButton.type = "button";
  printButton.textContent = "打印 / 保存为 PDF";
  printButton.disabled = true;
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "关闭预览";
  const frame = document.createElement("iframe");
  frame.title = "费用报销申请单";
  toolbar.append(message, printButton, closeButton);
  dialog.append(toolbar, frame);
  const previousFocus = document.activeElement;
  const previousOverflow = document.body.style.overflow;
  const close = () => {
    dialog.close();
    dialog.remove();
    document.body.style.overflow = previousOverflow;
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
  };
  closeButton.addEventListener("click", close);
  dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
  const print = () => {
    try {
      if (!frame.contentWindow) throw new Error("预览尚未加载");
      message.textContent = "在打印窗口中选择“另存为 PDF”。若未弹出，请点击右侧打印按钮，或在普通浏览器中打开本项目。";
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      message.textContent = "当前环境无法打开打印窗口，请在 Chrome 或 Edge 中打开本项目后重试。";
    }
  };
  printButton.addEventListener("click", print);
  frame.addEventListener("load", async () => {
    await frame.contentDocument?.fonts.ready;
    if (!dialog.isConnected) return;
    printButton.disabled = false;
    print();
  }, { once: true });
  const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
  frame.srcdoc = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>费用报销申请单</title>
    <link rel="stylesheet" href="${escape(new URL(`${import.meta.env.BASE_URL}fonts/fonts.css`, window.location.href).href)}">
    <style>
      *{box-sizing:border-box}body{font-family:"App Helvetica","App MiSans",sans-serif;color:#111;margin:24px;font-size:12px}
      h1{text-align:center;font-size:24px;margin:24px 0}.toolbar{background:#edf2f7;padding:16px;display:flex;align-items:center;gap:16px}
      button{padding:10px 20px;cursor:pointer}.meta{display:flex;justify-content:space-between;margin:20px 0;gap:20px}
      table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #888;padding:8px;overflow-wrap:anywhere;text-align:left}
      th{background:#f0f0f0}.money{text-align:right;white-space:nowrap}.total{text-align:right;font-weight:bold;margin:18px 0}
      .signatures{display:flex;justify-content:space-between;margin:36px 0}.approval{margin-top:24px;line-height:2}.approval-section{break-inside:avoid}
      thead{display:table-header-group}tr{break-inside:avoid}@page{size:A4 landscape;margin:14mm}
      @media print{body{margin:0}.toolbar{display:none}}
    </style></head><body>
    <h1>费用报销申请单</h1><div class="meta"><span>申请人：________________</span><span>申请日期：${escape(new Date().toLocaleDateString("sv-SE"))}</span><span>币种：${currencies[currency]}（${currency}）</span></div>
    <table><colgroup><col style="width:5%"><col style="width:11%"><col style="width:12%"><col style="width:26%"><col style="width:10%"><col style="width:12%"><col style="width:9%"><col style="width:15%"></colgroup>
    <thead><tr>${["序号", "日期", "部门", "报销事由", "类别", `金额（${currency}）`, "状态", "收据文件"].map(title => `<th>${title}</th>`).join("")}</tr></thead>
    <tbody>${items.map((item, index) => `<tr><td>${index + 1}</td><td>${escape(item.date)}</td><td>${escape(item.department?.name || "未知")}</td><td>${escape(item.desc)}</td><td>${escape(item.category)}</td><td class="money">${item.amount.toFixed(2)}</td><td>${escape(item.status)}</td><td>${escape(item.receipt_filename || "—")}</td></tr>`).join("")}</tbody></table>
    <div class="approval-section"><p class="total">共 ${items.length} 项　合计：${currency} ${selectedTotal(items).toFixed(2)}</p>
    <div class="signatures"><span>申请人签字：____________</span><span>部门负责人：____________</span><span>审批人：____________</span></div>
    <p class="approval">审批意见：________________________________________________________________________________</p></div>
    </body></html>`;
  document.body.appendChild(dialog);
  document.body.style.overflow = "hidden";
  dialog.showModal();
}
