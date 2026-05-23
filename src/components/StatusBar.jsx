import "./StatusBar.css";

export default function StatusBar({
  cursorLine,
  cursorColumn,
  isDirty,
  lineEnding,
  missingOnDisk,
}) {
  return (
    <div className="statusbar">
      <span className={missingOnDisk ? "status-warning" : ""}>
        {missingOnDisk ? "源文件已被外部删除" : "就绪"}
      </span>
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
