import { useState, useCallback, useEffect, useRef } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readDir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { isSupportedFile, getFileName, getParentDir } from "../utils/fileTypes";
import { addRecentFile } from "../utils/recentFiles";

function createSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDraftSession(index) {
  return {
    id: createSessionId(),
    kind: "draft",
    filePath: "",
    fileName: `未命名-${index}.md`,
    content: "",
    isDirty: false,
  };
}

function createFileSession(path, content) {
  return {
    id: createSessionId(),
    kind: "file",
    filePath: path,
    fileName: getFileName(path),
    content,
    isDirty: false,
  };
}

function replaceSession(sessions, updatedSession) {
  return sessions.map((session) =>
    session.id === updatedSession.id ? updatedSession : session
  );
}

function mergeSavedSession(sessions, updatedSession) {
  return sessions
    .filter(
      (session) =>
        session.id === updatedSession.id || session.filePath !== updatedSession.filePath
    )
    .map((session) =>
      session.id === updatedSession.id ? updatedSession : session
    );
}

export function useFileSystem({ updateSettings, settings }) {
  const [dirFiles, setDirFiles] = useState([]);
  const [workspace, setWorkspace] = useState(() => {
    const initialDraft = createDraftSession(1);
    return {
      sessions: [initialDraft],
      activeSessionId: initialDraft.id,
      nextDraftIndex: 2,
    };
  });

  const workspaceRef = useRef(workspace);

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  const activeSession =
    workspace.sessions.find((session) => session.id === workspace.activeSessionId) ??
    workspace.sessions[0];

  useEffect(() => {
    let cancelled = false;

    const loadDirFiles = async () => {
      if (!activeSession?.filePath) {
        setDirFiles([]);
        return;
      }

      try {
        const dir = getParentDir(activeSession.filePath);
        const entries = await readDir(dir);
        const files = entries
          .filter((entry) => !entry.isDirectory && isSupportedFile(entry.name))
          .map((entry) => ({ name: entry.name, path: dir + "/" + entry.name }))
          .sort((a, b) => {
            const extA = a.name.split(".").pop().toLowerCase();
            const extB = b.name.split(".").pop().toLowerCase();
            const order = { md: 0, markdown: 1, txt: 2 };
            const diff = (order[extA] ?? 3) - (order[extB] ?? 3);
            if (diff !== 0) return diff;
            return a.name.localeCompare(b.name);
          });

        if (!cancelled) {
          setDirFiles(files);
        }
      } catch {
        if (!cancelled) {
          setDirFiles([]);
        }
      }
    };

    loadDirFiles();
    return () => {
      cancelled = true;
    };
  }, [activeSession?.filePath]);

  const loadFileContent = useCallback(
    async (path) => {
      const existingSession = workspaceRef.current.sessions.find(
        (session) => session.filePath === path
      );

      const newRecent = addRecentFile(settings.recentFiles, path);
      updateSettings({ recentFiles: newRecent });

      if (existingSession) {
        setWorkspace((prev) => ({
          ...prev,
          activeSessionId: existingSession.id,
        }));
        return;
      }

      const text = await readTextFile(path);
      const fileSession = createFileSession(path, text);

      setWorkspace((prev) => ({
        ...prev,
        sessions: [...prev.sessions, fileSession],
        activeSessionId: fileSession.id,
      }));
    },
    [settings.recentFiles, updateSettings]
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

  const persistActiveSession = useCallback(
    async (targetPath) => {
      const currentSession = workspaceRef.current.sessions.find(
        (session) => session.id === workspaceRef.current.activeSessionId
      );
      if (!currentSession) return false;

      await writeTextFile(targetPath, currentSession.content);

      const updatedSession = {
        ...currentSession,
        kind: "file",
        filePath: targetPath,
        fileName: getFileName(targetPath),
        isDirty: false,
      };

      setWorkspace((prev) => ({
        ...prev,
        sessions: mergeSavedSession(prev.sessions, updatedSession),
        activeSessionId: updatedSession.id,
      }));

      const newRecent = addRecentFile(settings.recentFiles, targetPath);
      updateSettings({ recentFiles: newRecent });
      return true;
    },
    [settings.recentFiles, updateSettings]
  );

  const saveFile = useCallback(async () => {
    const currentSession = workspaceRef.current.sessions.find(
      (session) => session.id === workspaceRef.current.activeSessionId
    );
    if (!currentSession) return false;

    if (currentSession.filePath) {
      return persistActiveSession(currentSession.filePath);
    }

    const selected = await save({
      defaultPath: currentSession.fileName,
      filters: [
        { name: "Markdown", extensions: ["md"] },
        { name: "Text", extensions: ["txt"] },
      ],
    });

    if (selected) {
      return persistActiveSession(selected);
    }

    return false;
  }, [persistActiveSession]);

  const saveAsFile = useCallback(async () => {
    const currentSession = workspaceRef.current.sessions.find(
      (session) => session.id === workspaceRef.current.activeSessionId
    );
    if (!currentSession) return false;

    const selected = await save({
      defaultPath: currentSession.fileName,
      filters: [
        { name: "Markdown", extensions: ["md"] },
        { name: "Text", extensions: ["txt"] },
      ],
    });

    if (selected) {
      return persistActiveSession(selected);
    }

    return false;
  }, [persistActiveSession]);

  const newFile = useCallback(() => {
    setWorkspace((prev) => {
      const draftSession = createDraftSession(prev.nextDraftIndex);
      return {
        sessions: [...prev.sessions, draftSession],
        activeSessionId: draftSession.id,
        nextDraftIndex: prev.nextDraftIndex + 1,
      };
    });
  }, []);

  const switchSession = useCallback((sessionId) => {
    setWorkspace((prev) => {
      if (!prev.sessions.some((session) => session.id === sessionId)) {
        return prev;
      }

      return {
        ...prev,
        activeSessionId: sessionId,
      };
    });
  }, []);

  const updateContent = useCallback((newContent) => {
    setWorkspace((prev) => {
      const currentSession = prev.sessions.find(
        (session) => session.id === prev.activeSessionId
      );

      if (!currentSession || currentSession.content === newContent) {
        return prev;
      }

      const updatedSession = {
        ...currentSession,
        content: newContent,
        isDirty: true,
      };

      return {
        ...prev,
        sessions: replaceSession(prev.sessions, updatedSession),
      };
    });
  }, []);

  const dirtySessionCount = workspace.sessions.filter(
    (session) => session.isDirty
  ).length;

  return {
    filePath: activeSession?.filePath ?? "",
    fileName: activeSession?.fileName ?? "未命名.md",
    content: activeSession?.content ?? "",
    isDirty: Boolean(activeSession?.isDirty),
    dirFiles,
    sessions: workspace.sessions,
    activeSessionId: workspace.activeSessionId,
    dirtySessionCount,
    hasDirtySessions: dirtySessionCount > 0,
    openFile,
    saveFile,
    saveAsFile,
    newFile,
    loadFileContent,
    updateContent,
    switchSession,
  };
}
