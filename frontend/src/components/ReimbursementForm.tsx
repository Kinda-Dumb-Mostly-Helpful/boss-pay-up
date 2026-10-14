import { useTranslation } from "../i18n";
import React, { useId, useState } from "react";
import PendingAttachment from "./PendingAttachment";
import { useCurrency } from "../currency";
import type { Department, ReceiptImage } from "../types";

interface ReimbursementFormProps {
  editingId: string | null;
  desc: string;
  setDesc: (value: string) => void;
  amount: string;
  setAmount: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  date: string;
  setDate: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  departmentId: string;
  setDepartmentId: (value: string) => void;
  departments: Department[];
  selectedFiles: File[];
  setSelectedFiles: (files: File[]) => void;
  images: Record<string, ReceiptImage[]>;
  uploadingImage: boolean;
  handleSubmit: () => void;
  handleResetForm: () => void;
  handleDeleteImage: (imageId: string) => void;
  currentReceiptFilename: string | null;
  formErrors: {
    desc?: string;
    amount?: string;
    date?: string;
    departmentId?: string;
    submit?: string;
  };
  canSubmit: boolean;
}

const ReimbursementForm: React.FC<ReimbursementFormProps> = ({
  editingId,
  desc,
  setDesc,
  amount,
  setAmount,
  category,
  setCategory,
  date,
  setDate,
  status,
  setStatus,
  departmentId,
  setDepartmentId,
  departments,
  selectedFiles,
  setSelectedFiles,
  images,
  uploadingImage,
  handleSubmit,
  handleResetForm,
  handleDeleteImage,
  currentReceiptFilename,
  formErrors,
  canSubmit,
}) => {
  const t = useTranslation();
  const currency = useCurrency();
  const uploadId = useId();
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState("");
  function addFiles(files: File[]) {
    if (uploadingImage) return;
    const valid = files.filter(file => file.type.startsWith("image/"));
    setFileError(valid.length === files.length ? "" : "仅支持图片，其他类型的文件已忽略。");
    const next = [...selectedFiles];
    valid.forEach(file => {
      if (!next.some(existing => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified)) next.push(file);
    });
    setSelectedFiles(next);
  }
  const onEnterSubmit = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && canSubmit && !uploadingImage) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={`form-panel ${editingId ? "editing-mode" : ""}`}>
      <div className="form-title">
        <div className="form-title-main">
          <i>📝</i> {editingId ? t("编辑报销明细") : t("新增报销明细")}
        </div>
        {editingId && (
          <span className="editing-badge">{t("正在编辑 #")}{editingId.slice(0, 8)}</span>
        )}
      </div>
      {formErrors.submit && <div className="form-error-banner">{t(formErrors.submit)}</div>}

      <div className="form-section">
        <h4>{t("基础信息")}</h4>
        <div className="form-row">
          <div className="form-group">
            <label>{t("📌 事由 / 描述")}</label>
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onKeyDown={onEnterSubmit}
              placeholder={t("例如：项目聚餐、打车费...")}
              maxLength={50}
              autoFocus={!editingId}
            />
            {formErrors.desc && <p className="field-error">{t(formErrors.desc)}</p>}
          </div>
          <div className="form-group">
            <label>{t("💰 金额 (")}{currency})</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={onEnterSubmit}
              placeholder="0.00"
              min="0.01"
              step="0.01"
            />
            {formErrors.amount && <p className="field-error">{t(formErrors.amount)}</p>}
          </div>
        </div>
      </div>

      <div className="form-section">
        <h4>{t("报销属性")}</h4>
        <div className="form-row">
          <div className="form-group">
            <label>{t("📂 类别")}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="交通">{t("🚕 交通")}</option>
              <option value="餐饮">{t("🍜 餐饮")}</option>
              <option value="办公用品">{t("📎 办公用品")}</option>
              <option value="住宿">{t("🏨 住宿")}</option>
              <option value="其他">{t("📦 其他")}</option>
            </select>
          </div>
          <div className="form-group">
            <label>{t("🏢 部门")}</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              disabled={departments.length === 0}
              defaultValue={departments.length > 0 ? departments[0].id : ""}
            >
              {departments.length === 0 ? (
                <option value="">{t("请先添加部门")}</option>
              ) : (
                departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))
              )}
            </select>
            {formErrors.departmentId && (
              <p className="field-error">{t(formErrors.departmentId)}</p>
            )}
          </div>
          <div className="form-group">
            <label>{t("📅 日期")}</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            {formErrors.date && <p className="field-error">{t(formErrors.date)}</p>}
          </div>
          <div className="form-group">
            <label>{t("🧾 状态")}</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="已报销">{t("✅ 已报销")}</option>
              <option value="待审批">{t("⏳ 待审批")}</option>
              <option value="驳回">{t("❌ 驳回")}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="form-section receipt-section">
        <div className="attachment-heading"><h4>{t("附件图")}</h4><span>{t("支持多张图片")}</span></div>
        <div className="form-group">
          <div className={`attachment-dropzone ${dragging ? "is-dragging" : ""} ${uploadingImage ? "is-disabled" : ""}`}
            onDragOver={event => { event.preventDefault(); if (!uploadingImage) setDragging(true); }}
            onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
            onDrop={event => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }}>
          <label htmlFor={uploadId} className="attachment-upload-label">
            <span className="attachment-upload-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V3m-4 4 4-4 4 4M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" /></svg></span>
            <span><strong>{uploadingImage ? t("正在保存附件…") : t("点击选择或拖入图片")}</strong><small>{t("可多次添加，保存明细时统一上传")}</small></span>
          </label>
          <input
            id={uploadId}
            className="attachment-file-input"
            type="file"
            accept="image/*"
            multiple
            disabled={uploadingImage}
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              addFiles(files);
              e.target.value = "";
            }}
          />
          </div>
          {fileError && <p className="field-error" role="alert">{t(fileError)}</p>}
          {selectedFiles.length > 0 && <div className="attachment-list-heading"><span>{t("待上传")}<b>{selectedFiles.length}</b></span><button type="button" disabled={uploadingImage} onClick={() => setSelectedFiles([])}>{t("清空")}</button></div>}
          <div className="attachment-grid">
          {selectedFiles.map((file, index) => (
            <PendingAttachment key={`${file.name}-${file.lastModified}-${index}`} file={file} disabled={uploadingImage} onRemove={() => setSelectedFiles(selectedFiles.filter((_, position) => position !== index))} />
          ))}
          </div>

          {currentReceiptFilename && !Object.values(images[editingId || ""] || []).some(image => image.filepath.split(/[\\/]/).pop() === currentReceiptFilename) && (
            <div className="existing-file">
              {t("当前附件:")}<a
                href={`/api/upload/${currentReceiptFilename}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {currentReceiptFilename}
              </a>
            </div>
          )}

          {/* Display uploaded images for the reimbursement being edited */}
          {editingId && images[editingId] && images[editingId].length > 0 && (
            <div className="uploaded-image-list">
              <div className="attachment-list-heading"><span>{t("已上传")}<b>{images[editingId].length}</b></span><small>{t("点击图片查看原图")}</small></div>
              <div className="attachment-grid">
                {images[editingId].map((image) => (
                  <div key={image.id} className="attachment-card">
                    <a
                      href={`/api/upload/${image.filepath.split(/[\\/]/).pop()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="uploaded-image-link"
                    >
                      <img src={`/api/upload/${image.filepath.split(/[\\/]/).pop()}`} alt={image.filename} loading="lazy" />
                      <div className="attachment-caption"><span title={image.filename}>{image.filename}</span><small className="attachment-saved">{t("已保存")}</small></div>
                    </a>
                    <button
                      type="button"
                      disabled={uploadingImage}
                      onClick={() => handleDeleteImage(image.id)}
                      className="attachment-remove"
                      aria-label={`删除附件 ${image.filename}`}
                      title={t("删除已上传附件")}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="action-btns sticky-actions">
        <div className="action-buttons">
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={uploadingImage}
          >
            {uploadingImage
              ? t("上传中...")
              : editingId
                ? t("✏️ 更新记录")
                : t("➕ 添加记录")}
          </button>
          <button
            className="btn btn-outline"
            onClick={handleResetForm}
            disabled={uploadingImage}
          >
            {editingId ? t("取消编辑") : t("清除")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReimbursementForm;
