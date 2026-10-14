import { useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function AttachmentPreview({ src, name }: { src: string; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [failed, setFailed] = useState(false);
  const image = /\.(png|jpe?g|gif|webp|bmp|avif)(?:$|\?)/i.test(src);
  if (!image || failed) return <a href={src} target="_blank" rel="noopener noreferrer">{name}</a>;
  return <>
    <button type="button" className="receipt-thumbnail" title={name} aria-label={name} onClick={() => dialog.current?.showModal()}>
      <img src={src} alt={name} loading="lazy" onError={() => setFailed(true)} />
    </button>
    {createPortal(<dialog ref={dialog} className="receipt-lightbox" aria-label={name} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="receipt-lightbox-bar"><span>{name}</span><button type="button" aria-label="Close" onClick={() => dialog.current?.close()}>×</button></div>
      <a href={src} target="_blank" rel="noopener noreferrer"><img src={src} alt={name} /></a>
    </dialog>, document.body)}
  </>;
}
