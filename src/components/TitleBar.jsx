import { useCallback, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import DropdownMenu from "./DropdownMenu";
import "./TitleBar.css";

const appWindow = getCurrentWindow();

const FILE_MENU = [
  { label: "新建", action: "newFile", shortcut: "Ctrl+N" },
  { label: "打开", action: "openFile", shortcut: "Ctrl+O" },
  "---",
  { label: "保存", action: "saveFile", shortcut: "Ctrl+S" },
  { label: "另存为", action: "saveAs", shortcut: "Ctrl+Shift+S" },
  "---",
  { label: "关闭窗口", action: "closeWindow" },
];

const EDIT_MENU = [
  { label: "撤销", action: "undo", shortcut: "Ctrl+Z" },
  { label: "重做", action: "redo", shortcut: "Ctrl+Y" },
  "---",
  { label: "剪切", action: "cut", shortcut: "Ctrl+X" },
  { label: "复制", action: "copy", shortcut: "Ctrl+C" },
  { label: "粘贴", action: "paste", shortcut: "Ctrl+V" },
  { label: "全选", action: "selectAll", shortcut: "Ctrl+A" },
  "---",
  { label: "查找", action: "find", shortcut: "Ctrl+F" },
  { label: "替换", action: "replace", shortcut: "Ctrl+H" },
];

const VIEW_MENU = [
  { label: "文本模式", action: "viewEdit", shortcut: "Ctrl+1" },
  { label: "左右模式", action: "viewSplit", shortcut: "Ctrl+2" },
  { label: "预览模式", action: "viewPreview", shortcut: "Ctrl+3" },
  "---",
  { label: "显示/隐藏侧边栏", action: "toggleSidebar", shortcut: "Ctrl+B" },
  "---",
  { label: "放大字体", action: "zoomIn", shortcut: "Ctrl+=" },
  { label: "缩小字体", action: "zoomOut", shortcut: "Ctrl+-" },
  { label: "重置字体大小", action: "zoomReset", shortcut: "Ctrl+0" },
];

const HELP_MENU = [
  { label: "关于 MDPad", action: "about" },
  { label: "快捷键说明", action: "shortcuts" },
];

export default function TitleBar({ fileName, isDirty, onMenuAction, onCloseWindow }) {
  const [openMenu, setOpenMenu] = useState(null);
  const title = `${fileName}${isDirty ? " *" : ""} - MDPad`;

  const handleMouseDown = async (e) => {
    if (e.button !== 0 || e.target.closest("button") || e.target.closest(".dropdown")) return;
    try {
      await appWindow.startDragging();
    } catch {
      return;
    }
  };

  const createMenuHandlers = useCallback(
    (menuKey) => ({
      isOpen: openMenu === menuKey,
      onOpen: () => setOpenMenu(menuKey),
      onClose: () => setOpenMenu((current) => (current === menuKey ? null : current)),
    }),
    [openMenu]
  );

  return (
    <div className="titlebar" onMouseDown={handleMouseDown}>
      <div className="app-title">{title}</div>
      <div className="menu">
        <DropdownMenu label="文件" items={FILE_MENU} onAction={onMenuAction} {...createMenuHandlers("file")} />
        <DropdownMenu label="编辑" items={EDIT_MENU} onAction={onMenuAction} {...createMenuHandlers("edit")} />
        <DropdownMenu label="查看" items={VIEW_MENU} onAction={onMenuAction} {...createMenuHandlers("view")} />
        <DropdownMenu label="帮助" items={HELP_MENU} onAction={onMenuAction} {...createMenuHandlers("help")} />
      </div>
      <div className="window-actions">
        <button type="button" className="win-btn" onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()} onClick={() => appWindow.minimize()}>─</button>
        <button type="button" className="win-btn" onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()} onClick={() => appWindow.toggleMaximize()}>□</button>
        <button type="button" className="win-btn close" onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()} onClick={onCloseWindow}>×</button>
      </div>
    </div>
  );
}
