import { useState, useCallback, useEffect, useRef } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { getFileName, getParentDir } from "../utils/fileTypes";
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

function createInitialWorkspace() {
  const initialDraft = createDraftSession(1);
  return {
    sessions: [initialDraft],
    activeSessionId: initialDraft.id,
    nextDraftIndex: 2,
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
    missingOnDisk: false,
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

export function useFileSystem({ updateSettings }) {
  const [dirFiles, setDirFiles] = useState([]);
  const [refreshToken, setRefreshToken] = useState(0);
  const [workspace, setWorkspace] = useState(createInitialWorkspace);

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
        const files = await invoke("list_supported_documents", { path: dir });

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
  }, [activeSession?.filePath, refreshToken]);

  const refreshFileState = useCallback(async () => {
    const sessions = workspaceRef.current.sessions;

    const results = await Promise.all(
      sessions.map(async (session) => {
        if (!session.filePath) return session;

        const stillExists = await invoke("document_exists", {
          path: session.filePath,
        });
        if (session.missingOnDisk === !stillExists) {
          return session;
        }

        return {
          ...session,
          missingOnDisk: !stillExists,
        };
      })
    );

    setWorkspace((prev) => ({
      ...prev,
      sessions: results,
    }));
    setRefreshToken((value) => value + 1);
  }, []);

  const addToRecentFiles = useCallback(
    (path) =>
      updateSettings((prev) => ({
        recentFiles: addRecentFile(prev.recentFiles, path),
      })),
    [updateSettings]
  );

  const loadFileContent = useCallback(
    async (path) => {
      const existingSession = workspaceRef.current.sessions.find(
        (session) => session.filePath === path
      );

      if (existingSession) {
        setWorkspace((prev) => ({
          ...prev,
          activeSessionId: existingSession.id,
        }));
        await addToRecentFiles(path);
        return;
      }

      const text = await invoke("read_text_document", { path });
      const fileSession = createFileSession(path, text);

      setWorkspace((prev) => ({
        ...prev,
        sessions: [...prev.sessions, fileSession],
        activeSessionId: fileSession.id,
      }));
      await addToRecentFiles(path);
    },
    [addToRecentFiles]
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

      await invoke("write_text_document", {
        path: targetPath,
        content: currentSession.content,
      });

      const updatedSession = {
        ...currentSession,
        kind: "file",
        filePath: targetPath,
        fileName: getFileName(targetPath),
        isDirty: false,
        missingOnDisk: false,
      };

      setWorkspace((prev) => ({
        ...prev,
        sessions: mergeSavedSession(prev.sessions, updatedSession),
        activeSessionId: updatedSession.id,
      }));

      await addToRecentFiles(targetPath);
      return true;
    },
    [addToRecentFiles]
  );

  const saveFile = useCallback(async () => {
    const currentSession = workspaceRef.current.sessions.find(
      (session) => session.id === workspaceRef.current.activeSessionId
    );
    if (!currentSession) return false;

    if (currentSession.filePath && !currentSession.missingOnDisk) {
      return persistActiveSession(currentSession.filePath);
    }

    const selected = await save({
      defaultPath: currentSession.filePath || currentSession.fileName,
      filters: [
        { name: "Markdown", extensions: ["md"] },
        { name: "Text", extensions: ["txt"] },
      ],
    });

    if (selected) {
      const result = await persistActiveSession(selected);
      setRefreshToken((value) => value + 1);
      return result;
    }

    return false;
  }, [persistActiveSession]);

  const saveAsFile = useCallback(async () => {
    const currentSession = workspaceRef.current.sessions.find(
      (session) => session.id === workspaceRef.current.activeSessionId
    );
    if (!currentSession) return false;

    const selected = await save({
      defaultPath: currentSession.filePath || currentSession.fileName,
      filters: [
        { name: "Markdown", extensions: ["md"] },
        { name: "Text", extensions: ["txt"] },
      ],
    });

    if (selected) {
      const result = await persistActiveSession(selected);
      setRefreshToken((value) => value + 1);
      return result;
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

  const closeSession = useCallback((sessionId) => {
    setWorkspace((prev) => {
      const closingIndex = prev.sessions.findIndex(
        (session) => session.id === sessionId
      );

      if (closingIndex === -1) {
        return prev;
      }

      if (prev.sessions.length === 1) {
        return createInitialWorkspace();
      }

      const remainingSessions = prev.sessions.filter(
        (session) => session.id !== sessionId
      );
      const activeSessionId =
        prev.activeSessionId === sessionId
          ? remainingSessions[Math.min(closingIndex, remainingSessions.length - 1)].id
          : prev.activeSessionId;

      return {
        ...prev,
        sessions: remainingSessions,
        activeSessionId,
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
    missingOnDisk: Boolean(activeSession?.missingOnDisk),
    dirtySessionCount,
    hasDirtySessions: dirtySessionCount > 0,
    openFile,
    saveFile,
    saveAsFile,
    newFile,
    loadFileContent,
    updateContent,
    switchSession,
    closeSession,
    refreshFileState,
  };
}
