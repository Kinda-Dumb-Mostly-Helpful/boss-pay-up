import { useTranslation } from "../i18n";
import React from "react";
import type { Department } from "../types";

interface DepartmentManagerProps {
  showDepartmentManager: boolean;
  editingDepartmentId: string | null;
  departmentName: string;
  setDepartmentName: (value: string) => void;
  departmentDescription: string;
  setDepartmentDescription: (value: string) => void;
  departments: Department[];
  handleAddDepartment: () => void;
  handleEditDepartment: (dept: Department) => void;
  handleDeleteDepartment: (id: string) => void;
  resetDepartmentForm: () => void;
  setShowDepartmentManager: (value: boolean) => void;
}

const DepartmentManager: React.FC<DepartmentManagerProps> = ({
  showDepartmentManager,
  editingDepartmentId,
  departmentName,
  setDepartmentName,
  departmentDescription,
  setDepartmentDescription,
  departments,
  handleAddDepartment,
  handleEditDepartment,
  handleDeleteDepartment,
  resetDepartmentForm,
  setShowDepartmentManager,
}) => {
  const t = useTranslation();
  if (!showDepartmentManager) return null;

  return (
    <div className="form-panel" style={{ marginBottom: "1.5rem" }}>
      <div className="form-title">
        <i>🏢</i> {editingDepartmentId ? t("编辑部门") : t("添加新部门")}
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>{t("部门名称")}</label>
          <input
            type="text"
            value={departmentName}
            onChange={(e) => setDepartmentName(e.target.value)}
            placeholder={t("例如：技术部、市场部")}
            maxLength={30}
          />
        </div>
        <div className="form-group">
          <label>{t("部门描述")}</label>
          <input
            type="text"
            value={departmentDescription}
            onChange={(e) => setDepartmentDescription(e.target.value)}
            placeholder={t("部门职责描述")}
            maxLength={100}
          />
        </div>
        <div className="action-btns">
          <button className="btn btn-primary" onClick={handleAddDepartment}>
            {editingDepartmentId ? t("更新部门") : t("添加部门")}
          </button>
          <button
            className="btn btn-outline"
            onClick={() => {
              resetDepartmentForm();
              setShowDepartmentManager(false);
            }}
          >
            {t("取消")}</button>
        </div>
      </div>

      {/* Department list */}
      <div style={{ marginTop: "1.5rem" }}>
        <h3 style={{ marginBottom: "0.75rem" }}>{t("现有部门")}</h3>
        <div className="department-list">
          {departments.map((dept) => (
            <div key={dept.id} className="department-item">
              <div className="department-info">
                <strong>{dept.name}</strong>
                <span>{dept.description || "暂无描述"}</span>
                <small>
                  {t("创建于:")}{new Date(dept.created_at).toLocaleDateString()}
                </small>
              </div>
              <div className="department-actions">
                <button
                  className="edit-btn"
                  onClick={() => handleEditDepartment(dept)}
                  title={t("编辑")}
                >
                  ✏️
                </button>
                <button
                  className="delete-btn"
                  onClick={() => handleDeleteDepartment(dept.id)}
                  title={t("删除")}
                  disabled={departments.length <= 1}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DepartmentManager;
