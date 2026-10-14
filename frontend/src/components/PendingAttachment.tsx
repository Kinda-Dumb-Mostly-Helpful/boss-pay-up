import { useTranslation } from "../i18n";
import { useEffect, useState } from "react";

const isImageFile = (file: File) =>
  file.type.startsWith("image/") || /\.(png|jpe?g|gif|bmp|webp)$/i.test(file.name);

const fileSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default function PendingAttachment({ file, disabled, onRemove }: {
  file: File; disabled: boolean; onRemove: () => void;
}) {
  const t = useTranslation();
  const [preview, setPreview] = useState("");
  const image = isImageFile(file);
  useEffect(() => {
    if (!image) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, image]);
  const extension = file.name.includes(".") ? file.name.split(".").pop() : "";
  return <div className="attachment-card pending-attachment">
    {image && preview
      ? <a href={preview} target="_blank" rel="noopener noreferrer" title={`预览 ${file.name}`}><img src={preview} alt={file.name} /></a>
      : <span className="archive-attachment-file"><span aria-hidden="true">📄</span>{extension && <small>{extension}</small>}</span>}
    <div className="attachment-caption"><span title={file.name}>{file.name}</span><small>{fileSize(file.size)} {t("· 待上传")}</small></div>
    <button type="button" className="attachment-remove" disabled={disabled} onClick={onRemove} aria-label={`移除 ${file.name}`} title={t("移除待上传图片")}>×</button>
  </div>;
}
