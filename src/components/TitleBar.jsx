import { getCurrentWindow } from "@tauri-apps/api/window";
import "./TitleBar.css";

const appWindow = getCurrentWindow();

export default function TitleBar({ fileName, isDirty }) {
  const title = `${fileName}${isDirty ? " *" : ""} - MDPad`;

  const handleMouseDown = async (e) => {
    if (e.button !== 0 || e.target.closest("button")) return;

    try {
      await appWindow.startDragging();
    } catch (error) {
      console.error("Failed to start window dragging:", error);
    }
  };

  return (
    <div className="titlebar" data-tauri-drag-region onMouseDown={handleMouseDown}>
      <div className="app-title" data-tauri-drag-region>{title}</div>
      <div className="menu" data-tauri-drag-region>
        <span data-tauri-drag-region>文件</span>
        <span data-tauri-drag-region>编辑</span>
        <span data-tauri-drag-region>查看</span>
        <span data-tauri-drag-region>帮助</span>
      </div>
      <div className="window-actions">
        <button className="win-btn" onClick={() => appWindow.minimize()}>─</button>
        <button className="win-btn" onClick={() => appWindow.toggleMaximize()}>□</button>
        <button className="win-btn close" onClick={() => appWindow.close()}>×</button>
      </div>
    </div>
  );
}
