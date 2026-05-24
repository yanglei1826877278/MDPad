import { useState, useEffect, useCallback, useRef } from "react";
import { readTextFile, writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";

const DEFAULT_SETTINGS = {
  theme: "graphite",
  viewMode: "split",
  sidebarVisible: true,
  editorFontSize: 14,
  previewFontSize: 14,
  wordWrap: true,
  recentFiles: [],
};

async function getSettingsPath() {
  const dir = await appDataDir();
  return join(dir, "settings.json");
}

export function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const settingsRef = useRef(DEFAULT_SETTINGS);
  const saveQueueRef = useRef(Promise.resolve(true));

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const path = await getSettingsPath();
        const existsFlag = await exists(path);
        if (existsFlag) {
          const text = await readTextFile(path);
          const parsed = JSON.parse(text);
          const next = {
            ...settingsRef.current,
            ...parsed,
            recentFiles: [
              ...settingsRef.current.recentFiles,
              ...(parsed.recentFiles ?? []),
            ].reduce((files, file) => {
              if (!file?.path || files.some((item) => item.path === file.path)) {
                return files;
              }

              files.push(file);
              return files;
            }, []),
          };

          if (cancelled) {
            return;
          }

          settingsRef.current = next;
          setSettings(next);
        }
      } catch {
        return;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const saveSettings = useCallback((newSettings) => {
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      try {
        const dir = await appDataDir();
        await mkdir(dir, { recursive: true });
        const path = await getSettingsPath();
        await writeTextFile(path, JSON.stringify(newSettings, null, 2));
        return true;
      } catch {
        return false;
      }
    });

    return saveQueueRef.current;
  }, []);

  const updateSettings = useCallback(
    (partial) => {
      const patch =
        typeof partial === "function" ? partial(settingsRef.current) : partial;
      const next = { ...settingsRef.current, ...patch };
      settingsRef.current = next;
      setSettings(next);
      return saveSettings(next);
    },
    [saveSettings]
  );

  return { settings, updateSettings };
}
