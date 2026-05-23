import "./StatusBar.css";

export default function StatusBar({
  cursorLine,
  cursorColumn,
  isDirty,
  lineEnding,
}) {
  return (
    <div className="statusbar">
      <span>就绪</span>
      <span>
        第 {cursorLine} 行，第 {cursorColumn} 列
      </span>
      <span>{isDirty ? "已修改" : "已保存"}</span>
      <div className="status-right">
        <span>Markdown</span>
        <span>UTF-8</span>
        <span>{lineEnding}</span>
      </div>
    </div>
  );
}
