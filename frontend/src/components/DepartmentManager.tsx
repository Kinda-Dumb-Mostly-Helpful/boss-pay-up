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
    <div className="department-workspace">
      <section className="department-editor">
      <div className="form-title">
        <i>🏢</i> {editingDepartmentId ? t("编辑部门") : t("添加新部门")}
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="department-name">{t("部门名称")}</label>
          <input
            id="department-name"
            type="text"
            value={departmentName}
            onChange={(e) => setDepartmentName(e.target.value)}
            placeholder={t("例如：技术部、市场部")}
            maxLength={30}
          />
        </div>
        <div className="form-group">
          <label htmlFor="department-description">{t("部门描述")}</label>
          <input
            id="department-description"
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

      </section>
      <section className="department-directory">
        <div className="department-directory-heading">
          <h3>{t("现有部门")} <span>{departments.length}</span></h3>
          <button type="button" className="department-collapse" onClick={() => setShowDepartmentManager(false)}>
            <span>{t("收起部门管理")}</span>
            <span className="department-collapse-icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 15 6-6 6 6" /></svg></span>
          </button>
        </div>
        <div className="department-list">
          {departments.map((dept) => (
            <div key={dept.id} className={`department-item${editingDepartmentId === dept.id ? " is-editing" : ""}`}>
              <div className="department-info">
                <div className="department-card-heading">
                  <strong>{dept.name}</strong>
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
                <span>{dept.description || "暂无描述"}</span>
                <small>
                  {t("创建于:")}{new Date(dept.created_at).toLocaleDateString()}
                </small>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default DepartmentManager;
