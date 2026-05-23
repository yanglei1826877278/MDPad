import { useCallback, useEffect, useState } from "react";
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

function MinimizeIcon() {
  return (
    <svg className="win-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M3.5 11.5h9" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg className="win-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="4.5" y="4.5" width="7" height="7" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg className="win-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M6.5 4.5h5v5" />
      <rect x="4.5" y="6.5" width="5" height="5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="win-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
    </svg>
  );
}

export default function TitleBar({ fileName, isDirty, onMenuAction, onCloseWindow }) {
  const [openMenu, setOpenMenu] = useState(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const title = `${fileName}${isDirty ? " *" : ""} - MDPad`;

  useEffect(() => {
    let cancelled = false;

    const updateMaximizedState = async () => {
      try {
        const maximized = await appWindow.isMaximized();
        if (!cancelled) {
          setIsMaximized(maximized);
        }
      } catch {
        return;
      }
    };

    void updateMaximizedState();
    const unlistenPromise = appWindow.onResized(updateMaximizedState);

    return () => {
      cancelled = true;
      unlistenPromise.then((fn) => fn());
    };
  }, []);

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

  const handleToggleMaximize = useCallback(async () => {
    try {
      await appWindow.toggleMaximize();
      setIsMaximized(await appWindow.isMaximized());
    } catch {
      return;
    }
  }, []);

  const stopWindowDrag = (e) => e.stopPropagation();

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
        <button
          type="button"
          className="win-btn"
          aria-label="最小化"
          title="最小化"
          onMouseDown={stopWindowDrag}
          onMouseUp={stopWindowDrag}
          onClick={() => appWindow.minimize()}
        >
          <MinimizeIcon />
        </button>
        <button
          type="button"
          className="win-btn"
          aria-label={isMaximized ? "还原" : "最大化"}
          title={isMaximized ? "还原" : "最大化"}
          onMouseDown={stopWindowDrag}
          onMouseUp={stopWindowDrag}
          onClick={handleToggleMaximize}
        >
          {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
        </button>
        <button
          type="button"
          className="win-btn close"
          aria-label="关闭"
          title="关闭"
          onMouseDown={stopWindowDrag}
          onMouseUp={stopWindowDrag}
          onClick={onCloseWindow}
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}
