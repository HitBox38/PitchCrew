import type { Locator, Page } from 'playwright';

/**
 * The shared Markdown editor is CodeMirror: its text and selection live in editor state, not in
 * a form value, and only visible lines are in the DOM. These read and set that state directly.
 */
type EditorElement = HTMLElement & {
  // CodeMirror links its content element to the editor view (EditorView.findFromDOM reads it).
  cmTile?: {
    root: {
      view: {
        state: {
          doc: { toString: () => string };
          selection: { main: { from: number; to: number } };
        };
        dispatch: (spec: { selection: { anchor: number; head: number } }) => void;
      };
    };
  };
};

export const editorValue = (editor: Locator) =>
  editor.evaluate((element) => (element as EditorElement).cmTile!.root.view.state.doc.toString());

export const editorSelection = (editor: Locator) =>
  editor.evaluate((element) => {
    const { from, to } = (element as EditorElement).cmTile!.root.view.state.selection.main;
    return [from, to];
  });

export const selectInEditor = (editor: Locator, anchor: number, head: number) =>
  editor.evaluate(
    (element, range) => (element as EditorElement).cmTile!.root.view.dispatch({ selection: range }),
    { anchor, head },
  );

/** Tests of unsaved drafts turn autosave off for the page, as a user can in the status menu. */
export const disableAutosave = (page: Page) =>
  page.addInitScript(() => localStorage.setItem('pitchcrew.profile.autosave', 'false'));
