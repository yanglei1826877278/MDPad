import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, redo, selectAll, undo } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import {
  SearchQuery,
  findNext,
  replaceAll as replaceAllCommand,
  replaceNext,
  search,
  setSearchQuery,
} from "@codemirror/search";

const EditorPane = forwardRef(function EditorPane(
  { content, onChange, fontSize, onSelectionChange },
  ref
) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const syncingExternalContentRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
    onSelectionChangeRef.current = onSelectionChange;
  }, [onChange, onSelectionChange]);

  const emitSelectionInfo = (view) => {
    if (!view || !onSelectionChangeRef.current) return;
    const head = view.state.selection.main.head;
    const line = view.state.doc.lineAt(head);
    onSelectionChangeRef.current({
      line: line.number,
      column: head - line.from + 1,
    });
  };

  const countMatches = (view, query) => {
    let count = 0;
    const cursor = query.getCursor(view.state);
    for (let next = cursor.next(); !next.done; next = cursor.next()) {
      count += 1;
    }
    return count;
  };

  const setQuery = (view, searchText, replaceText = "") => {
    const query = new SearchQuery({ search: searchText, replace: replaceText });
    view.dispatch({ effects: setSearchQuery.of(query) });
    return query;
  };

  const execClipboardCommand = (command) => {
    if (typeof document === "undefined" || typeof document.execCommand !== "function") {
      return false;
    }
    try {
      return document.execCommand(command);
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        search(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !syncingExternalContentRef.current) {
            onChangeRef.current(update.state.doc.toString());
          }
          if (update.docChanged || update.selectionSet || update.focusChanged) {
            emitSelectionInfo(update.view);
          }
        }),
        EditorView.theme({
          "&": { height: "100%" },
          ".cm-scroller": { overflow: "auto" },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    emitSelectionInfo(view);
    return () => view.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== content) {
      syncingExternalContentRef.current = true;
      view.dispatch({
        changes: { from: 0, to: current.length, insert: content },
      });
      syncingExternalContentRef.current = false;
    }
  }, [content]);

  useImperativeHandle(ref, () => ({
    focus() {
      viewRef.current?.focus();
    },
    find(searchText) {
      const view = viewRef.current;
      if (!view) return { ok: false, reason: "unavailable", count: 0 };
      if (!searchText) return { ok: false, reason: "empty", count: 0 };

      const query = setQuery(view, searchText);
      const count = countMatches(view, query);
      if (count === 0) return { ok: false, reason: "nomatch", count: 0 };

      view.focus();
      findNext(view);
      return { ok: true, count };
    },
    replace(searchText, replaceText) {
      const view = viewRef.current;
      if (!view) return { ok: false, reason: "unavailable", count: 0 };
      if (!searchText) return { ok: false, reason: "empty", count: 0 };

      const query = setQuery(view, searchText, replaceText);
      const count = countMatches(view, query);
      if (count === 0) return { ok: false, reason: "nomatch", count: 0 };

      view.focus();
      replaceNext(view);
      return { ok: true, count };
    },
    replaceAll(searchText, replaceText) {
      const view = viewRef.current;
      if (!view) return { ok: false, reason: "unavailable", count: 0 };
      if (!searchText) return { ok: false, reason: "empty", count: 0 };

      const query = setQuery(view, searchText, replaceText);
      const count = countMatches(view, query);
      if (count === 0) return { ok: false, reason: "nomatch", count: 0 };

      view.focus();
      replaceAllCommand(view);
      return { ok: true, count };
    },
    undo() {
      const view = viewRef.current;
      if (!view) return false;
      view.focus();
      return undo(view);
    },
    redo() {
      const view = viewRef.current;
      if (!view) return false;
      view.focus();
      return redo(view);
    },
    selectAll() {
      const view = viewRef.current;
      if (!view) return false;
      view.focus();
      return selectAll(view);
    },
    async copy() {
      const view = viewRef.current;
      if (!view) return false;

      const selectedText = view.state.selection.ranges
        .filter((range) => !range.empty)
        .map((range) => view.state.sliceDoc(range.from, range.to))
        .join("\n");

      if (!selectedText) return false;

      view.focus();
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(selectedText);
          return true;
        } catch {
          return execClipboardCommand("copy");
        }
      }

      return execClipboardCommand("copy");
    },
    async cut() {
      const view = viewRef.current;
      if (!view) return false;

      const selectedText = view.state.selection.ranges
        .filter((range) => !range.empty)
        .map((range) => view.state.sliceDoc(range.from, range.to))
        .join("\n");

      if (!selectedText) return false;

      view.focus();
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(selectedText);
        } catch {
          if (!execClipboardCommand("cut")) {
            return false;
          }
          return true;
        }
      } else if (!execClipboardCommand("cut")) {
        return false;
      } else {
        return true;
      }

      const transaction = view.state.changeByRange((range) =>
        range.empty
          ? { range }
          : {
              changes: { from: range.from, to: range.to, insert: "" },
              range: EditorSelection.cursor(range.from),
            }
      );

      view.dispatch({
        ...transaction,
        scrollIntoView: true,
        userEvent: "delete.cut",
      });
      return true;
    },
    async paste() {
      const view = viewRef.current;
      if (!view) return false;

      view.focus();

      let text = null;
      if (navigator.clipboard?.readText) {
        try {
          text = await navigator.clipboard.readText();
        } catch {
          text = null;
        }
      }

      if (text == null) {
        return execClipboardCommand("paste");
      }

      view.dispatch({
        ...view.state.replaceSelection(text),
        scrollIntoView: true,
        userEvent: "input.paste",
      });
      return true;
    },
  }));

  return (
    <div
      ref={containerRef}
      style={{ fontSize: fontSize + "px", height: "100%" }}
    />
  );
});

EditorPane.displayName = "EditorPane";

export default EditorPane;
