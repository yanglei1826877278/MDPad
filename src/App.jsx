import { useState, useCallback, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import TitleBar from "./components/TitleBar";
import Toolbar from "./components/Toolbar";
import Sidebar from "./components/Sidebar";
import EditorPane from "./components/EditorPane";
import PreviewPane from "./components/PreviewPane";
import StatusBar from "./components/StatusBar";
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
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [fs]);

  useEffect(() => {
    const handler = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "n") {
        e.preventDefault();
        fs.newFile();
      } else if (ctrl && e.key === "o") {
        e.preventDefault();
        fs.openFile();
      } else if (ctrl && e.shiftKey && e.key === "S") {
        e.preventDefault();
        fs.saveAsFile();
      } else if (ctrl && e.key === "s") {
        e.preventDefault();
        fs.saveFile();
      } else if (ctrl && e.key === "1") {
        e.preventDefault();
        updateSettings({ viewMode: "edit" });
      } else if (ctrl && e.key === "2") {
        e.preventDefault();
        updateSettings({ viewMode: "split" });
      } else if (ctrl && e.key === "3") {
        e.preventDefault();
        updateSettings({ viewMode: "preview" });
      } else if (ctrl && e.key === "b") {
        e.preventDefault();
        updateSettings({ sidebarVisible: !settings.sidebarVisible });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fs, settings.sidebarVisible, updateSettings]);

  useEffect(() => {
    const unlisten = getCurrentWindow().onCloseRequested(async (event) => {
      if (fs.isDirty) {
        const confirmed = window.confirm(
          "当前文件尚未保存，是否保存？\n\n确定 = 不保存直接关闭\n取消 = 取消关闭"
        );
        if (!confirmed) {
          event.preventDefault();
        }
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [fs.isDirty]);

  const { viewMode } = settings;

  return (
    <div className="app">
      <TitleBar fileName={fs.fileName} isDirty={fs.isDirty} />
      <Toolbar
        filePath={fs.filePath}
        theme={settings.theme}
        viewMode={viewMode}
        onOpen={fs.openFile}
        onSave={fs.saveFile}
        onSaveAs={fs.saveAsFile}
        onNew={fs.newFile}
        onThemeChange={(theme) => updateSettings({ theme })}
        onViewModeChange={(mode) => updateSettings({ viewMode: mode })}
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
              <PreviewPane
                content={previewContent}
                fontSize={settings.previewFontSize}
              />
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
