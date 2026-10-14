import { useTranslation } from "../i18n";
import React from "react";
import { useCurrency } from "../currency";

interface HeaderSummaryProps {
  totalCount: number;
  totalAmount: number;
  pendingCount: number;
  departmentCount: number;
}

const HeaderSummary: React.FC<HeaderSummaryProps> = ({
  totalCount,
  totalAmount,
  pendingCount,
  departmentCount,
}) => {
  const t = useTranslation();
  const currency = useCurrency();
  return (
    <div className="header">
      <div className="summary-card">
        <div className="summary-item">
          <span className="label">{t("总报销单数")}</span>
          <span className="value">{totalCount}</span>
        </div>
        <div className="summary-item">
          <span className="label">{t("总金额")}</span>
          <span className="value"><small>{currency}</small> {totalAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className="summary-item">
          <span className="label">{t("待审批")}</span>
          <span className="value">{pendingCount}</span>
        </div>
        <div className="summary-item">
          <span className="label">{t("部门数")}</span>
          <span className="value">{departmentCount}</span>
        </div>
      </div>
    </div>
  );
};

export default HeaderSummary;
