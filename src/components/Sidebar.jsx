import "./Sidebar.css";
import { getFileType } from "../utils/fileTypes";

export default function Sidebar({
  sessions,
  activeSessionId,
  dirFiles,
  recentFiles,
  currentFilePath,
  onFileClick,
  onSessionClick,
  visible,
}) {
  if (!visible) return null;

  return (
    <aside className="sidebar">
      <div className="side-section">
        <div className="side-title">打开会话</div>
        <div className="file-list">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={
                "file-item" + (session.id === activeSessionId ? " active" : "")
              }
              onClick={() => onSessionClick(session.id)}
              title={session.filePath || session.fileName}
            >
              <span className="file-icon">
                {session.kind === "draft" ? "TMP" : getFileType(session.fileName)}
              </span>
              <span className="file-name">
                {session.fileName}
                {session.isDirty ? " *" : ""}
              </span>
              {session.kind === "draft" && (
                <span className="file-badge">临时</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="side-section">
        <div className="side-title">当前目录</div>
        <div className="file-list">
          {dirFiles.length === 0 && (
            <div className="hint">打开文件后显示目录列表</div>
          )}
          {dirFiles.map((f) => (
            <div
              key={f.path}
              className={
                "file-item" + (f.path === currentFilePath ? " active" : "")
              }
              onClick={() => onFileClick(f.path)}
            >
              <span className="file-icon">{getFileType(f.name)}</span>
              <span className="file-name">{f.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="side-section">
        <div className="side-title">最近打开</div>
        <div className="file-list">
          {recentFiles.length === 0 && (
            <div className="hint">暂无最近打开的文件</div>
          )}
          {recentFiles.map((f) => (
            <div
              key={f.path}
              className={
                "file-item" + (f.path === currentFilePath ? " active" : "")
              }
              onClick={() => onFileClick(f.path)}
            >
              <span className="file-icon">{getFileType(f.name)}</span>
              <span className="file-name">{f.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="hint">
        拖入 .md 或 .txt 文件即可打开。
        <br />
        支持左右预览、纯文本、纯预览。
      </div>
    </aside>
  );
}
