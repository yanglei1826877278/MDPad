import { useState, useEffect, useCallback } from "react";
import { readFile, writeFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import { appDataDir } from "@tauri-apps/api/path";

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
  return dir + "settings.json";
}

export function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    (async () => {
      try {
        const path = await getSettingsPath();
        const existsFlag = await exists(path);
        if (existsFlag) {
          const data = await readFile(path);
          const text = new TextDecoder().decode(data);
          const parsed = JSON.parse(text);
          setSettings((prev) => ({ ...prev, ...parsed }));
        }
      } catch (_) {}
    })();
  }, []);

  const saveSettings = useCallback(
    async (newSettings) => {
      try {
        const dir = await appDataDir();
        await mkdir(dir, { recursive: true });
        const path = dir + "settings.json";
        const data = new TextEncoder().encode(
          JSON.stringify(newSettings || settings, null, 2)
        );
        await writeFile(path, data);
      } catch (_) {}
    },
    [settings]
  );

  const updateSettings = useCallback(
    (partial) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial };
        saveSettings(next);
        return next;
      });
    },
    [saveSettings]
  );

  return { settings, updateSettings };
}
