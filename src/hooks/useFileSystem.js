import { useState, useCallback } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { isSupportedFile, getFileName, getParentDir } from "../utils/fileTypes";
import { addRecentFile } from "../utils/recentFiles";
import { readDir } from "@tauri-apps/plugin-fs";

export function useFileSystem({ onContentChange, updateSettings, settings }) {
  const [filePath, setFilePath] = useState("");
  const [fileName, setFileName] = useState("Untitled.md");
  const [content, setContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [dirFiles, setDirFiles] = useState([]);

  const loadFileContent = useCallback(
    async (path) => {
      const data = await readFile(path);
      const text = new TextDecoder().decode(data);
      setFilePath(path);
      setFileName(getFileName(path));
      setContent(text);
      setIsDirty(false);
      onContentChange(text);

      const newRecent = addRecentFile(settings.recentFiles, path);
      updateSettings({ recentFiles: newRecent });

      try {
        const dir = getParentDir(path);
        const entries = await readDir(dir);
        const files = entries
          .filter((e) => !e.isDirectory && isSupportedFile(e.name))
          .map((e) => ({ name: e.name, path: dir + "/" + e.name }))
          .sort((a, b) => {
            const extA = a.name.split(".").pop().toLowerCase();
            const extB = b.name.split(".").pop().toLowerCase();
            const order = { md: 0, markdown: 1, txt: 2 };
            const diff = (order[extA] ?? 3) - (order[extB] ?? 3);
            if (diff !== 0) return diff;
            return a.name.localeCompare(b.name);
          });
        setDirFiles(files);
      } catch (_) {
        setDirFiles([]);
      }
    },
    [onContentChange, settings.recentFiles, updateSettings]
  );

  const openFile = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Markdown & Text",
          extensions: ["md", "markdown", "txt"],
        },
      ],
    });
    if (selected) {
      await loadFileContent(selected);
    }
  }, [loadFileContent]);

  const saveFile = useCallback(async () => {
    if (filePath) {
      const data = new TextEncoder().encode(content);
      await writeFile(filePath, data);
      setIsDirty(false);
    } else {
      const selected = await save({
        defaultPath: "Untitled.md",
        filters: [
          { name: "Markdown", extensions: ["md"] },
          { name: "Text", extensions: ["txt"] },
        ],
      });
      if (selected) {
        const data = new TextEncoder().encode(content);
        await writeFile(selected, data);
        setFilePath(selected);
        setFileName(getFileName(selected));
        setIsDirty(false);
        const newRecent = addRecentFile(settings.recentFiles, selected);
        updateSettings({ recentFiles: newRecent });
      }
    }
  }, [filePath, content, settings.recentFiles, updateSettings]);

  const saveAsFile = useCallback(async () => {
    const selected = await save({
      defaultPath: fileName,
      filters: [
        { name: "Markdown", extensions: ["md"] },
        { name: "Text", extensions: ["txt"] },
      ],
    });
    if (selected) {
      const data = new TextEncoder().encode(content);
      await writeFile(selected, data);
      setFilePath(selected);
      setFileName(getFileName(selected));
      setIsDirty(false);
      const newRecent = addRecentFile(settings.recentFiles, selected);
      updateSettings({ recentFiles: newRecent });
    }
  }, [fileName, content, settings.recentFiles, updateSettings]);

  const newFile = useCallback(() => {
    setFilePath("");
    setFileName("Untitled.md");
    setContent("");
    setIsDirty(false);
    onContentChange("");
  }, [onContentChange]);

  const updateContent = useCallback(
    (newContent) => {
      setContent(newContent);
      setIsDirty(true);
      onContentChange(newContent);
    },
    [onContentChange]
  );

  return {
    filePath,
    fileName,
    content,
    isDirty,
    setIsDirty,
    dirFiles,
    openFile,
    saveFile,
    saveAsFile,
    newFile,
    loadFileContent,
    updateContent,
  };
}
