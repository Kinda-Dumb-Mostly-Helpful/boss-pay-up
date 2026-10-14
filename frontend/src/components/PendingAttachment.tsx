import { useTranslation } from "../i18n";
import { useEffect, useState } from "react";

export default function PendingAttachment({ file, disabled, onRemove }: {
  file: File; disabled: boolean; onRemove: () => void;
}) {
  const t = useTranslation();
  const [preview, setPreview] = useState("");
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <div className="attachment-card pending-attachment">
    {preview && <a href={preview} target="_blank" rel="noopener noreferrer" title={`预览 ${file.name}`}><img src={preview} alt={file.name} /></a>}
    <div className="attachment-caption"><span title={file.name}>{file.name}</span><small>{file.size < 1024 * 1024 ? `${Math.ceil(file.size / 1024)} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`} {t("· 待上传")}</small></div>
    <button type="button" className="attachment-remove" disabled={disabled} onClick={onRemove} aria-label={`移除 ${file.name}`} title={t("移除待上传图片")}>×</button>
  </div>;
}
