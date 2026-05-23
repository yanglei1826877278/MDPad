const MAX_RECENT = 10;

export function addRecentFile(list, filePath) {
  const filtered = list.filter((f) => f.path !== filePath);
  filtered.unshift({
    path: filePath,
    name: filePath.replace(/\\/g, "/").split("/").pop(),
    lastOpenedAt: Date.now(),
  });
  return filtered.slice(0, MAX_RECENT);
}

export function removeRecentFile(list, filePath) {
  return list.filter((f) => f.path !== filePath);
}
