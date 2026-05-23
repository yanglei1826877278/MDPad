import "./Toolbar.css";

const THEMES = [
  { key: "dark-pro", label: "Dark" },
  { key: "graphite", label: "Graphite" },
  { key: "nord", label: "Nord" },
  { key: "light", label: "Light" },
  { key: "warm", label: "Warm" },
];

const VIEWS = [
  { key: "edit", label: "文本" },
  { key: "split", label: "左右" },
  { key: "preview", label: "预览" },
];

export default function Toolbar({
  filePath,
  theme,
  viewMode,
  onOpen,
  onSave,
  onSaveAs,
  onNew,
  onThemeChange,
  onViewModeChange,
}) {
  return (
    <div className="toolbar">
      <button className="tool-btn" onClick={onNew}>新建</button>
      <button className="tool-btn primary" onClick={onOpen}>打开</button>
      <button className="tool-btn" onClick={onSave}>保存</button>
      <button className="tool-btn" onClick={onSaveAs}>另存为</button>

      <div className="separator" />

      <div className="view-switch">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            className={viewMode === v.key ? "active" : ""}
            onClick={() => onViewModeChange(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="path" title={filePath}>
        {filePath || "未打开文件"}
      </div>

      <div className="theme-switch">
        {THEMES.map((t) => (
          <button
            key={t.key}
            className={theme === t.key ? "active" : ""}
            onClick={() => onThemeChange(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
