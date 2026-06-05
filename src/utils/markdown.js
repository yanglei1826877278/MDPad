import MarkdownIt from "markdown-it";
import hljs from "highlight.js";

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value;
      } catch {
        return "";
      }
    }
    try {
      return hljs.highlightAuto(str).value;
    } catch {
      return "";
    }
  },
});

const defaultImageRenderer =
  md.renderer.rules.image ??
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

function splitPathSuffix(src) {
  const queryIndex = src.indexOf("?");
  const hashIndex = src.indexOf("#");
  const indexes = [queryIndex, hashIndex].filter((index) => index !== -1);
  const suffixIndex = indexes.length > 0 ? Math.min(...indexes) : -1;

  if (suffixIndex === -1) {
    return { path: src, suffix: "" };
  }

  return {
    path: src.slice(0, suffixIndex),
    suffix: src.slice(suffixIndex),
  };
}

function hasUrlProtocol(src) {
  return /^[a-z][a-z0-9+.-]*:/i.test(src) && !/^[a-z]:[\\/]/i.test(src);
}

function isLocalAbsolutePath(src) {
  return /^[a-z]:[\\/]/i.test(src) || src.startsWith("/") || src.startsWith("\\\\");
}

function normalizeLocalPath(path) {
  return path.replace(/\\/g, "/");
}

function decodeLocalPath(path) {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

function joinLocalPath(baseDir, relativePath) {
  const joined = `${normalizeLocalPath(baseDir).replace(/\/+$/, "")}/${normalizeLocalPath(relativePath)}`;
  const prefixMatch = joined.match(/^([a-z]:|\/\/[^/]+\/[^/]+)?(\/?)(.*)$/i);
  const prefix = prefixMatch?.[1] ?? "";
  const leadingSlash = prefixMatch?.[2] ?? "";
  const rest = prefixMatch?.[3] ?? joined;
  const parts = [];

  for (const part of rest.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length > 0) {
        parts.pop();
      }
      continue;
    }
    parts.push(part);
  }

  return `${prefix}${leadingSlash}${parts.join("/")}`;
}

function getParentDir(filePath) {
  const normalized = normalizeLocalPath(filePath);
  const lastSlashIndex = normalized.lastIndexOf("/");
  return lastSlashIndex === -1 ? "" : normalized.slice(0, lastSlashIndex);
}

export function isExternalImageSrc(src) {
  return (
    !src ||
    src.startsWith("#") ||
    src.startsWith("//") ||
    hasUrlProtocol(src)
  );
}

function resolveLocalImagePath(src, documentPath) {
  if (
    isExternalImageSrc(src)
  ) {
    return "";
  }

  const { path, suffix } = splitPathSuffix(src);
  if (!path || suffix) {
    return "";
  }
  const decodedPath = decodeLocalPath(path);

  return isLocalAbsolutePath(decodedPath)
    ? normalizeLocalPath(decodedPath)
    : documentPath
      ? joinLocalPath(getParentDir(documentPath), decodedPath)
      : "";
}

md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const src = tokens[idx].attrGet("src");
  const localPath = resolveLocalImagePath(src, env.documentPath);

  if (localPath) {
    tokens[idx].attrSet("data-local-src", localPath);

    const loadedSrc = env.localImageUrls?.[localPath];
    if (loadedSrc) {
      tokens[idx].attrSet("src", loadedSrc);
    }
  }

  return defaultImageRenderer(tokens, idx, options, env, self);
};

export function renderMarkdown(
  text,
  { documentPath = "", localImageUrls = {} } = {}
) {
  return md.render(text || "", { documentPath, localImageUrls });
}
