import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { renderMarkdown } from "../utils/markdown";

export default function PreviewPane({ content, documentPath, fontSize }) {
  const previewRef = useRef(null);
  const loadingImagesRef = useRef(new Set());
  const [localImageUrls, setLocalImageUrls] = useState({});
  const html = useMemo(
    () => renderMarkdown(content, { documentPath, localImageUrls }),
    [content, documentPath, localImageUrls]
  );

  useEffect(() => {
    const images = Array.from(
      previewRef.current?.querySelectorAll("img[data-local-src]") ?? []
    );

    for (const image of images) {
      const path = image.getAttribute("data-local-src");
      if (!path || localImageUrls[path] || loadingImagesRef.current.has(path)) {
        continue;
      }

      loadingImagesRef.current.add(path);
      invoke("read_local_image_data_url", { path })
        .then((dataUrl) => {
          setLocalImageUrls((prev) =>
            prev[path] === dataUrl ? prev : { ...prev, [path]: dataUrl }
          );
        })
        .catch(() => {
          image.setAttribute("title", "图片加载失败");
        })
        .finally(() => {
          loadingImagesRef.current.delete(path);
        });
    }
  }, [html, localImageUrls]);

  return (
    <div
      ref={previewRef}
      className="preview-content"
      style={{ fontSize: fontSize + "px" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
