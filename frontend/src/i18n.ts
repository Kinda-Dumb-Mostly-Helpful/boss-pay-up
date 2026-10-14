import { useLoginUser } from "./auth";
import { english } from "./translations";
import { localizeEnglish } from "./localized";

// Display labels only: stored statuses and existing archive content stay intact.
const labels: Record<string, string> = {
  "审批组与历史档案": "审批批次与档案",
  "搜索审批组": "搜索审批批次",
  "搜索组名、编号、提交人": "搜索批次名称、编号、提交人",
  "没有符合筛选条件的审批组": "没有符合筛选条件的审批批次",
  "查看审批组": "查看审批批次",
  "已归入审批组": "已加入审批批次",
  "审批组已创建，前往“审批组与历史档案”处理。": "审批批次已创建，请前往“审批批次与档案”处理。",
  "一键提交审批": "提交审批",
  "整批一键已报销": "整批标记为已报销",
  "总报销单数": "报销明细数",
  "收据文件": "收据附件",
  "描述": "报销事由",
  "事由": "报销事由",
  "📌 事由 / 描述": "📌 报销事由",
  "管理部门": "部门管理",
  "驳回": "已驳回",
  "❌ 驳回": "❌ 已驳回",
};

export function translate(text: string, language: string) {
  if (language === "zh-CN") return labels[text] || text;
  if (english[text]) return language === "en" ? english[text] : localizeEnglish(english[text], language) || english[text];
  return text;
}
export function useTranslation() {
  const user = useLoginUser();
  return (text: string) => translate(text, user?.language || "zh-CN");
}
