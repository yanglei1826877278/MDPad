import { getCurrentWindow } from "@tauri-apps/api/window";
import "./TitleBar.css";

const appWindow = getCurrentWindow();

export default function TitleBar({ fileName, isDirty }) {
  const title = `${fileName}${isDirty ? " *" : ""} - MDPad`;

  const handleMouseDown = async (e) => {
    if (e.target.closest("button")) return;
    await appWindow.startDragging();
  };

  return (
    <div className="titlebar" onMouseDown={handleMouseDown}>
      <div className="app-title">{title}</div>
      <div className="menu">
        <span>文件</span>
        <span>编辑</span>
        <span>查看</span>
        <span>帮助</span>
      </div>
      <div className="window-actions">
        <button className="win-btn" onClick={() => appWindow.minimize()}>─</button>
        <button className="win-btn" onClick={() => appWindow.toggleMaximize()}>□</button>
        <button className="win-btn close" onClick={() => appWindow.close()}>×</button>
      </div>
    </div>
  );
}
