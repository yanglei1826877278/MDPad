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
      } catch (_) {}
    }
    try {
      return hljs.highlightAuto(str).value;
    } catch (_) {}
    return "";
  },
});

export function renderMarkdown(text) {
  return md.render(text || "");
}
