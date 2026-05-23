import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getFileType } from "../utils/fileTypes";
import "./Sidebar.css";

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
  const [contextMenu, setContextMenu] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!contextMenu) return undefined;

    const handlePointer = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setContextMenu(null);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    };

    window.addEventListener("mousedown", handlePointer);
    window.addEventListener("contextmenu", handlePointer);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointer);
      window.removeEventListener("contextmenu", handlePointer);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [contextMenu]);

  if (!visible) return null;

  const openContextMenu = (event, item) => {
    if (!item?.path && !item?.sessionId) return;

    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      ...item,
    });
  };

  const handleItemMouseDown = (event, item) => {
    if (event.button === 2) {
      openContextMenu(event, item);
    }
  };

  const handleOpenFromMenu = async () => {
    if (!contextMenu) return;
    setContextMenu(null);

    if (contextMenu.sessionId) {
      onSessionClick(contextMenu.sessionId);
      return;
    }

    if (contextMenu.path) {
      await onFileClick(contextMenu.path);
    }
  };

  const handleRevealInFolder = async () => {
    if (!contextMenu?.path) return;
    try {
      await invoke("reveal_in_folder", { path: contextMenu.path });
    } catch {
      alert("无法在系统文件夹中显示该文件，请确认路径仍然有效。");
    } finally {
      setContextMenu(null);
    }
  };

  const handleCopyPath = async () => {
    if (!contextMenu?.path) return;
    try {
      await navigator.clipboard.writeText(contextMenu.path);
    } catch {
      alert("复制路径失败，请稍后再试。");
    } finally {
      setContextMenu(null);
    }
  };

  const handleCopyName = async () => {
    if (!contextMenu?.name) return;
    try {
      await navigator.clipboard.writeText(contextMenu.name);
    } catch {
      alert("复制名称失败，请稍后再试。");
    } finally {
      setContextMenu(null);
    }
  };

  return (
    <aside className="sidebar">
      <div className="side-section">
        <div className="side-title">打开会话</div>
        <div className="file-list">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={
                "file-item" +
                (session.id === activeSessionId ? " active" : "") +
                (contextMenu?.path && contextMenu.path === session.filePath ? " context-active" : "")
              }
              onClick={() => onSessionClick(session.id)}
              onMouseDown={(event) =>
                handleItemMouseDown(event, {
                  path: session.filePath,
                  name: session.fileName,
                  sessionId: session.id,
                })
              }
              onContextMenu={(event) =>
                openContextMenu(event, {
                  path: session.filePath,
                  name: session.fileName,
                  sessionId: session.id,
                })
              }
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
                "file-item" +
                (f.path === currentFilePath ? " active" : "") +
                (contextMenu?.path === f.path ? " context-active" : "")
              }
              onClick={() => onFileClick(f.path)}
              onMouseDown={(event) => handleItemMouseDown(event, f)}
              onContextMenu={(event) => openContextMenu(event, f)}
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
                "file-item" +
                (f.path === currentFilePath ? " active" : "") +
                (contextMenu?.path === f.path ? " context-active" : "")
              }
              onClick={() => onFileClick(f.path)}
              onMouseDown={(event) => handleItemMouseDown(event, f)}
              onContextMenu={(event) => openContextMenu(event, f)}
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

      {contextMenu && (
        <div
          ref={menuRef}
          className="sidebar-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button className="sidebar-context-item" onClick={() => void handleOpenFromMenu()}>
            打开
          </button>
          <button
            className="sidebar-context-item"
            onClick={() => void handleRevealInFolder()}
            disabled={!contextMenu.path}
          >
            在文件夹中显示
          </button>
          <button
            className="sidebar-context-item"
            onClick={() => void handleCopyPath()}
            disabled={!contextMenu.path}
          >
            复制完整路径
          </button>
          <button className="sidebar-context-item" onClick={() => void handleCopyName()}>
            复制名称
          </button>
        </div>
      )}
    </aside>
  );
}
