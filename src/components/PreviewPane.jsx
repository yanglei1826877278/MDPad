import { useMemo } from "react";
import { renderMarkdown } from "../utils/markdown";

export default function PreviewPane({ content, fontSize }) {
  const html = useMemo(() => renderMarkdown(content), [content]);

  return (
    <div
      className="preview-content"
      style={{ fontSize: fontSize + "px" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
