export function isSupportedFile(filePath) {
  const lower = filePath.toLowerCase();
  return (
    lower.endsWith(".md") ||
    lower.endsWith(".markdown") ||
    lower.endsWith(".txt")
  );
}

export function getFileType(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".markdown")) return "MD";
  if (lower.endsWith(".md")) return "MD";
  if (lower.endsWith(".txt")) return "TXT";
  return "FILE";
}

export function getFileName(filePath) {
  if (!filePath) return "Untitled.md";
  const parts = filePath.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1];
}

export function getParentDir(filePath) {
  if (!filePath) return "";
  const parts = filePath.replace(/\\/g, "/").split("/");
  parts.pop();
  return parts.join("/");
}
