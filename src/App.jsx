import { useState, useCallback, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import TitleBar from "./components/TitleBar";
import Toolbar from "./components/Toolbar";
import Sidebar from "./components/Sidebar";
import EditorPane from "./components/EditorPane";
import PreviewPane from "./components/PreviewPane";
import StatusBar from "./components/StatusBar";
import FindReplaceBar from "./components/FindReplaceBar";
import { useSettings } from "./hooks/useSettings";
import { useFileSystem } from "./hooks/useFileSystem";
import { isSupportedFile } from "./utils/fileTypes";
import "./App.css";

export default function App() {
  const { settings, updateSettings } = useSettings();
  const [previewContent, setPreviewContent] = useState("");
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorColumn, setCursorColumn] = useState(1);
  const [lineEnding, setLineEnding] = useState("CRLF");
  const [showFind, setShowFind] = useState(false);
  const [showReplace, setShowReplace] = useState(false);

  const fs = useFileSystem({
    onContentChange: setPreviewContent,
    updateSettings,
    settings,
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", settings.theme);
  }, [settings.theme]);

  const handleFileClick = useCallback(
    async (path) => {
      try {
        await fs.loadFileContent(path);
      } catch (_) {
        alert("文件读取失败，请检查文件权限。");
      }
    },
    [fs]
  );

  // Drag & drop
  useEffect(() => {
    const unlisten = getCurrentWindow().onDragDropEvent((event) => {
      if (event.payload.type === "drop") {
        const paths = event.payload.paths;
        if (paths.length > 0) {
          const file = paths[0];
          if (isSupportedFile(file)) {
            fs.loadFileContent(file);
          } else {
            alert("暂不支持该文件类型，仅支持 .md、.markdown、.txt。");
          }
        }
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [fs]);

  // Find & Replace
  const handleFind = useCallback((text) => {
    if (!text) return;
    const idx = fs.content.indexOf(text, 0);
    if (idx !== -1) {
      // Scroll to and select the found text via content update trick
      // For simple implementation, we just highlight in preview
    }
  }, [fs.content]);

  const handleReplace = useCallback((findText, replaceText) => {
    if (!findText) return;
    const idx = fs.content.indexOf(findText);
    if (idx !== -1) {
      const newContent = fs.content.substring(0, idx) + replaceText + fs.content.substring(idx + findText.length);
      fs.updateContent(newContent);
    }
  }, [fs]);

  const handleReplaceAll = useCallback((findText, replaceText) => {
    if (!findText) return;
    const newContent = fs.content.split(findText).join(replaceText);
    fs.updateContent(newContent);
  }, [fs]);

  // Font zoom
  const zoomIn = useCallback(() => {
    const s = Math.min(22, settings.editorFontSize + 1);
    updateSettings({ editorFontSize: s, previewFontSize: s });
  }, [settings.editorFontSize, updateSettings]);

  const zoomOut = useCallback(() => {
    const s = Math.max(12, settings.editorFontSize - 1);
    updateSettings({ editorFontSize: s, previewFontSize: s });
  }, [settings.editorFontSize, updateSettings]);

  const zoomReset = useCallback(() => {
    updateSettings({ editorFontSize: 14, previewFontSize: 14 });
  }, [updateSettings]);

  // Menu actions
  const handleMenuAction = useCallback((action) => {
    switch (action) {
      case "newFile": fs.newFile(); break;
      case "openFile": fs.openFile(); break;
      case "saveFile": fs.saveFile(); break;
      case "saveAs": fs.saveAsFile(); break;
      case "closeWindow": getCurrentWindow().close(); break;
      case "undo": document.execCommand("undo"); break;
      case "redo": document.execCommand("redo"); break;
      case "cut": document.execCommand("cut"); break;
      case "copy": document.execCommand("copy"); break;
      case "paste": document.execCommand("paste"); break;
      case "selectAll": document.execCommand("selectAll"); break;
      case "find": setShowFind(true); setShowReplace(false); break;
      case "replace": setShowFind(true); setShowReplace(true); break;
      case "viewEdit": updateSettings({ viewMode: "edit" }); break;
      case "viewSplit": updateSettings({ viewMode: "split" }); break;
      case "viewPreview": updateSettings({ viewMode: "preview" }); break;
      case "toggleSidebar": updateSettings({ sidebarVisible: !settings.sidebarVisible }); break;
      case "zoomIn": zoomIn(); break;
      case "zoomOut": zoomOut(); break;
      case "zoomReset": zoomReset(); break;
      case "about":
        alert("MDPad v0.1.0\n一个轻量 Markdown 记事本。\n\nA lightweight Markdown notepad.");
        break;
      case "shortcuts":
        alert(
          "快捷键说明\n\n" +
          "Ctrl+N  新建\nCtrl+O  打开\nCtrl+S  保存\nCtrl+Shift+S  另存为\n" +
          "Ctrl+F  查找\nCtrl+H  替换\nCtrl+1  文本模式\nCtrl+2  左右模式\n" +
          "Ctrl+3  预览模式\nCtrl+B  侧边栏\nCtrl+=  放大字体\nCtrl+-  缩小字体\n" +
          "Ctrl+0  重置字体"
        );
        break;
      default: break;
    }
  }, [fs, settings.sidebarVisible, updateSettings, zoomIn, zoomOut, zoomReset]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "n") { e.preventDefault(); fs.newFile(); }
      else if (ctrl && e.key === "o") { e.preventDefault(); fs.openFile(); }
      else if (ctrl && e.shiftKey && e.key === "S") { e.preventDefault(); fs.saveAsFile(); }
      else if (ctrl && e.key === "s") { e.preventDefault(); fs.saveFile(); }
      else if (ctrl && e.key === "f") { e.preventDefault(); setShowFind(true); setShowReplace(false); }
      else if (ctrl && e.key === "h") { e.preventDefault(); setShowFind(true); setShowReplace(true); }
      else if (ctrl && e.key === "1") { e.preventDefault(); updateSettings({ viewMode: "edit" }); }
      else if (ctrl && e.key === "2") { e.preventDefault(); updateSettings({ viewMode: "split" }); }
      else if (ctrl && e.key === "3") { e.preventDefault(); updateSettings({ viewMode: "preview" }); }
      else if (ctrl && e.key === "b") { e.preventDefault(); updateSettings({ sidebarVisible: !settings.sidebarVisible }); }
      else if (ctrl && (e.key === "=" || e.key === "+")) { e.preventDefault(); zoomIn(); }
      else if (ctrl && e.key === "-") { e.preventDefault(); zoomOut(); }
      else if (ctrl && e.key === "0") { e.preventDefault(); zoomReset(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fs, settings.sidebarVisible, updateSettings, zoomIn, zoomOut, zoomReset]);

  // Close confirmation
  useEffect(() => {
    const unlisten = getCurrentWindow().onCloseRequested(async (event) => {
      if (fs.isDirty) {
        const confirmed = window.confirm(
          "当前文件尚未保存，是否保存？\n\n确定 = 不保存直接关闭\n取消 = 取消关闭"
        );
        if (!confirmed) event.preventDefault();
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [fs.isDirty]);

  const { viewMode } = settings;

  return (
    <div className="app">
      <TitleBar
        fileName={fs.fileName}
        isDirty={fs.isDirty}
        onMenuAction={handleMenuAction}
      />
      <Toolbar
        filePath={fs.filePath}
        theme={settings.theme}
        viewMode={viewMode}
        onOpen={fs.openFile}
        onSave={fs.saveFile}
        onSaveAs={fs.saveAsFile}
        onNew={fs.newFile}
        onFind={() => { setShowFind(true); setShowReplace(false); }}
        onReplace={() => { setShowFind(true); setShowReplace(true); }}
        onThemeChange={(theme) => updateSettings({ theme })}
        onViewModeChange={(mode) => updateSettings({ viewMode: mode })}
      />
      <FindReplaceBar
        visible={showFind}
        onFind={handleFind}
        onReplace={handleReplace}
        onReplaceAll={handleReplaceAll}
        onClose={() => { setShowFind(false); setShowReplace(false); }}
      />
      <div className="main">
        <Sidebar
          dirFiles={fs.dirFiles}
          recentFiles={settings.recentFiles}
          currentFilePath={fs.filePath}
          onFileClick={handleFileClick}
          visible={settings.sidebarVisible}
        />
        <section className="workspace">
          <div className={viewMode === "preview" ? "editor-pane hidden" : "editor-pane"}>
            <div className="pane-header">
              <span className="dot" />
              Markdown 文本
              <span className="info">UTF-8 · Markdown</span>
            </div>
            <div className="editor-container" style={{ fontSize: settings.editorFontSize + "px" }}>
              <EditorPane
                content={fs.content}
                onChange={fs.updateContent}
                fontSize={settings.editorFontSize}
              />
            </div>
          </div>
          <div className={viewMode === "edit" ? "preview-pane hidden" : "preview-pane"}>
            <div className="pane-header">
              <span className="dot" />
              实时预览
              <span className="info">GitHub 风格</span>
            </div>
            <div className="preview" style={{ fontSize: settings.previewFontSize + "px" }}>
              <PreviewPane content={previewContent} fontSize={settings.previewFontSize} />
            </div>
          </div>
        </section>
      </div>
      <StatusBar
        cursorLine={cursorLine}
        cursorColumn={cursorColumn}
        isDirty={fs.isDirty}
        lineEnding={lineEnding}
      />
    </div>
  );
}
