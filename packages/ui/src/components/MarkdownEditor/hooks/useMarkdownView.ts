import { openSearchPanel } from '@codemirror/search';
import { ChangeSet, EditorSelection, EditorState, type StateEffect } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useImperativeHandle, useLayoutEffect, useRef, type RefObject } from 'react';
import { markdownEdits } from '../commands.ts';
import {
  cursorOf,
  documentSettings,
  externalChange,
  markdownExtensions,
  run,
  settings,
} from '../extensions.ts';
import { syncChange } from '../helpers.ts';
import { revealMatch, startOfText } from '../reveal.ts';
import { attachView, revealSpot } from '../reading.ts';
import type { MarkdownEditorHandle, MarkdownEditorProps } from '../types.ts';

const kept = 24;

const create = (latest: RefObject<MarkdownEditorProps>, doc: string) =>
  EditorState.create({
    doc,
    extensions: [
      markdownExtensions(latest),
      doc.includes('\r\n') ? EditorState.lineSeparator.of('\r\n') : [],
    ],
  });

const identity = (key: string) => key.split('#')[0];

type Saved = { key: string; state: EditorState; scroll: StateEffect<unknown> };

/**
 * A fresh state for new text (new undo history) that keeps the old selection and scroll
 * position, both mapped through the change.
 */
const rebase = (latest: RefObject<MarkdownEditorProps>, old: Saved, doc: string) => {
  const next = create(latest, doc);
  const change = syncChange(old.state.doc.toString(), doc.replace(/\r\n?/g, '\n'));
  const changes = ChangeSet.of(change ? [change] : [], old.state.doc.length);
  const selection = old.state.selection.map(changes);
  const fits = selection.ranges.every((range) => range.to <= next.doc.length);
  return {
    state: fits ? next.update({ selection }).state : next,
    scroll: fits ? old.scroll.map(changes) : undefined,
  };
};

// The very top, padding included: the margin is larger than the space above the first line.
const top = EditorView.scrollIntoView(0, { y: 'start', yMargin: 200 });

const handleFor = (view: RefObject<EditorView | null>): MarkdownEditorHandle => ({
  format: (kind) => {
    if (!view.current) return;
    run(view.current, markdownEdits[kind]);
    view.current.focus();
  },
  focus: (at) => {
    const editor = view.current;
    if (!editor) return;
    const { main } = editor.state.selection;
    if (at === 'end') {
      const end = editor.state.doc.length;
      editor.dispatch({ selection: { anchor: end }, effects: EditorView.scrollIntoView(end) });
    } else if (main.empty && main.head === 0 && startOfText(editor.state)) {
      // A note opened at its top: typing goes into the title, not before its "# ".
      editor.dispatch({ selection: { anchor: startOfText(editor.state) } });
    }
    editor.focus();
  },
  revealText: (text, options) => {
    const editor = view.current;
    const needle = text.replace(/\r\n?/g, '\n');
    // Searched in the document's own text, so offsets stay right even where case folding
    // changes a string's length (İ lowercases to two characters).
    const found =
      needle && editor
        ? new RegExp(
            needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            options?.ignoreCase ? 'iu' : 'u',
          ).exec(editor.state.doc.toString())
        : null;
    if (!editor || !found) return false;
    const start = found.index;
    const end = Math.min(start + found[0].length, editor.state.doc.length);
    editor.dispatch({
      selection: EditorSelection.range(start, end),
      effects: [
        EditorView.scrollIntoView(EditorSelection.range(start, end), { y: 'center' }),
        revealMatch.of({ from: start, to: end }),
      ],
    });
    editor.focus();
    return true;
  },
  revealLine: (line) => {
    const editor = view.current;
    if (!editor) return;
    const target = editor.state.doc.line(Math.min(Math.max(1, line), editor.state.doc.lines));
    editor.dispatch({
      selection: { anchor: target.from },
      effects: EditorView.scrollIntoView(target.from, { y: 'start', yMargin: 24 }),
    });
    editor.focus();
  },
  openSearch: () => {
    if (view.current) openSearchPanel(view.current);
  },
});

/**
 * One CodeMirror view for the editor's lifetime. Each document keeps its own editor state (undo
 * history, selection, scroll), so switching tabs never loses them; the controlled `content`
 * still wins whenever it changes from outside, such as a discard or a newer saved copy.
 */
export const useMarkdownView = (props: MarkdownEditorProps) => {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const latest = useRef(props);
  // Keyed by the document's stable identity; `key` records which revision the state belongs to.
  const states = useRef(new Map<string, Saved>());
  const key = useRef(props.documentKey ?? '');
  // A hidden editor (Preview) cannot measure its scroll: keep the last position seen while it
  // was visible, and apply a position chosen while hidden once Write shows it again.
  const lastScroll = useRef<StateEffect<unknown>>(top);
  const pendingScroll = useRef<StateEffect<unknown> | null>(null);
  const visible = useRef(props.mode !== 'preview');
  useLayoutEffect(() => {
    latest.current = props;
  });
  useImperativeHandle(props.handle, () => handleFor(view), []);
  useLayoutEffect(() => {
    const editor = new EditorView({
      parent: host.current!,
      state: create(latest, latest.current.content),
    });
    view.current = editor;
    const bridge = latest.current.reading?.current;
    attachView(bridge, editor);
    latest.current.onCursor?.(cursorOf(editor.state));
    let frame = 0;
    const remember = () => {
      frame ||= requestAnimationFrame(() => {
        frame = 0;
        if (visible.current) lastScroll.current = editor.scrollSnapshot();
      });
    };
    editor.scrollDOM.addEventListener('scroll', remember, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      editor.scrollDOM.removeEventListener('scroll', remember);
      editor.destroy();
      view.current = null;
      attachView(bridge, null);
    };
  }, []);
  const hidden = props.mode === 'preview';
  useLayoutEffect(() => {
    const editor = view.current;
    visible.current = !hidden;
    if (!editor) return;
    if (hidden) {
      pendingScroll.current ??= lastScroll.current;
      return;
    }
    // Back from Preview where the reader scrolled: open Write at that block; otherwise where
    // Write itself was.
    const spot = latest.current.reading?.current.previewSpot;
    if (spot && revealSpot(editor, spot, () => visible.current)) {
      pendingScroll.current = null;
    } else if (pendingScroll.current) {
      editor.dispatch({ effects: pendingScroll.current });
      pendingScroll.current = null;
    }
  }, [hidden]);
  // Switch documents first, then reconcile the controlled value against the restored state.
  const documentKey = props.documentKey ?? '';
  useLayoutEffect(() => {
    const editor = view.current;
    if (!editor || documentKey === key.current) return;
    const leaving = identity(key.current);
    states.current.delete(leaving);
    states.current.set(leaving, {
      key: key.current,
      state: editor.state,
      scroll: visible.current ? editor.scrollSnapshot() : lastScroll.current,
    });
    if (states.current.size > kept) states.current.delete(states.current.keys().next().value!);
    const cached = states.current.get(identity(documentKey));
    // The same document after a disk copy replaced its text (open now, or while in another tab)
    // starts a fresh undo history but keeps its selection and scroll, mapped through the change.
    // Anything opened for the first time starts at its top.
    const previous =
      cached ?? (identity(documentKey) === leaving ? states.current.get(leaving) : undefined);
    const restored =
      cached?.key === documentKey
        ? { state: cached.state, scroll: cached.scroll }
        : previous
          ? rebase(latest, previous, latest.current.content)
          : { state: create(latest, latest.current.content), scroll: undefined };
    editor.setState(restored.state);
    key.current = documentKey;
    lastScroll.current = restored.scroll ?? top;
    if (visible.current) editor.dispatch({ effects: lastScroll.current });
    else pendingScroll.current = lastScroll.current;
    latest.current.onCursor?.(cursorOf(editor.state));
  }, [documentKey]);
  const { content } = props;
  useLayoutEffect(() => {
    const editor = view.current;
    const spec = editor ? externalChange(editor.state, content) : null;
    if (editor && spec) editor.dispatch(spec);
  }, [content, documentKey]);
  const { disabled, placeholder, label, id, describedBy, showSyntax } = props;
  useLayoutEffect(() => {
    view.current?.dispatch({
      effects: settings.reconfigure(
        documentSettings({
          ...latest.current,
          disabled,
          placeholder,
          label,
          id,
          describedBy,
          showSyntax,
        }),
      ),
    });
  }, [disabled, placeholder, label, id, describedBy, showSyntax, documentKey]);
  return host;
};
