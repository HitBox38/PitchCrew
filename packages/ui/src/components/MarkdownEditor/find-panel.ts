import {
  SearchQuery,
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  replaceAll,
  replaceNext,
  setSearchQuery,
} from '@codemirror/search';
import type { EditorState } from '@codemirror/state';
import type { EditorView, Panel, ViewUpdate } from '@codemirror/view';

const icon = (path: string) =>
  `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
const icons = {
  up: icon('<path d="m18 15-6-6-6 6"/>'),
  down: icon('<path d="m6 9 6 6 6-6"/>'),
  close: icon('<path d="M18 6 6 18M6 6l12 12"/>'),
  expand: icon('<path d="m9 18 6-6-6-6"/>'),
};

const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, string> = {},
  html = '',
) => {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) node.setAttribute(name, value);
  if (html) node.innerHTML = html;
  return node;
};

/** "3 of 12" for the match under the selection, "12 matches" otherwise; counting stops at 999. */
const matchCount = (state: EditorState, query: SearchQuery) => {
  if (!query.search || !query.valid) return '';
  const { from, to } = state.selection.main;
  let total = 0;
  let current = 0;
  const cursor = query.getCursor(state);
  for (let next = cursor.next(); !next.done && total < 999; next = cursor.next()) {
    total++;
    if (next.value.from === from && next.value.to === to) current = total;
  }
  if (!total) return 'No results';
  const count = total >= 999 ? '999+' : String(total);
  return current ? `${current} of ${count}` : `${count} ${total === 1 ? 'match' : 'matches'}`;
};

/**
 * A compact find bar floating at the top right of the note, like a code editor's: the query,
 * a live count, previous/next, case/word/regex toggles and a Replace row on request.
 */
export const findPanel = (view: EditorView): Panel => {
  const root = element('div', { class: 'md-find', role: 'search', 'aria-label': 'Find in note' });
  const row = element('div', { class: 'md-find-row' });
  const replaceRow = element('div', { class: 'md-find-row md-find-replace' });
  const origin = view.state.selection.main.from;
  replaceRow.hidden = true;
  const expand = element(
    'button',
    {
      type: 'button',
      class: 'md-find-button md-find-expand',
      'aria-label': 'Show replace',
      'aria-expanded': 'false',
      title: 'Replace',
    },
    icons.expand,
  );
  const field = element('input', {
    class: 'md-find-input',
    placeholder: 'Find',
    'aria-label': 'Find',
    'main-field': 'true',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const count = element('span', { class: 'md-find-count', 'aria-live': 'polite' });
  const button = (label: string, html: string, run: () => void, extra = '') => {
    const node = element(
      'button',
      { type: 'button', class: `md-find-button ${extra}`, 'aria-label': label, title: label },
      html,
    );
    node.addEventListener('mousedown', (event) => event.preventDefault());
    node.addEventListener('click', run);
    return node;
  };
  const toggle = (label: string, text: string, key: 'caseSensitive' | 'wholeWord' | 'regexp') => {
    const node = button(
      label,
      text,
      () => {
        node.setAttribute('aria-pressed', String(node.getAttribute('aria-pressed') !== 'true'));
        commit();
      },
      'md-find-toggle',
    );
    node.setAttribute('aria-pressed', 'false');
    node.dataset.option = key;
    return node;
  };
  const replaceField = element('input', {
    class: 'md-find-input',
    placeholder: 'Replace with',
    'aria-label': 'Replace with',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const toggles = [
    toggle('Match case', 'Aa', 'caseSensitive'),
    toggle('Whole word', '<u>ab</u>', 'wholeWord'),
    toggle('Regular expression', '.*', 'regexp'),
  ];
  const pressed = (key: string) =>
    toggles.find((node) => node.dataset.option === key)?.getAttribute('aria-pressed') === 'true';
  const commit = () => {
    const query = new SearchQuery({
      search: field.value,
      replace: replaceField.value,
      caseSensitive: pressed('caseSensitive'),
      wholeWord: pressed('wholeWord'),
      regexp: pressed('regexp'),
    });
    if (query.eq(getSearchQuery(view.state))) return;
    // Like a code editor: typing moves to the first match after where the caret started.
    const after = query.valid && query.search ? query.getCursor(view.state, origin).next() : null;
    // Nothing after the caret: wrap to the first match, as a code editor's find does.
    const first =
      after && after.done && origin > 0 ? query.getCursor(view.state, 0, origin).next() : after;
    view.dispatch({
      effects: setSearchQuery.of(query),
      ...(first && !first.done
        ? {
            selection: { anchor: first.value.from, head: first.value.to },
            scrollIntoView: true,
          }
        : {}),
    });
  };
  const close = () => {
    closeSearchPanel(view);
    view.focus();
  };
  expand.addEventListener('click', () => {
    replaceRow.hidden = !replaceRow.hidden;
    expand.setAttribute('aria-expanded', String(!replaceRow.hidden));
    expand.setAttribute('aria-label', replaceRow.hidden ? 'Show replace' : 'Hide replace');
    (replaceRow.hidden ? field : replaceField).focus();
  });
  for (const input of [field, replaceField]) {
    input.addEventListener('input', commit);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && input === field)
        (event.shiftKey ? findPrevious : findNext)(view);
      else if (event.key === 'Enter')
        (event.metaKey || event.ctrlKey ? replaceAll : replaceNext)(view);
      else return;
      event.preventDefault();
    });
  }
  row.append(
    expand,
    field,
    count,
    button('Previous match', icons.up, () => findPrevious(view)),
    button('Next match', icons.down, () => findNext(view)),
    ...toggles,
    button('Close find', icons.close, close, 'md-find-close'),
  );
  replaceRow.append(
    replaceField,
    button('Replace', 'Replace', () => replaceNext(view), 'md-find-text'),
    button('Replace all', 'All', () => replaceAll(view), 'md-find-text'),
  );
  root.append(row, replaceRow);
  // Escape closes find from any of its controls and returns to the text.
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    close();
  });
  const actions = [
    ...row.querySelectorAll('button:not(.md-find-toggle, .md-find-expand, .md-find-close)'),
    ...replaceRow.querySelectorAll('button'),
  ] as HTMLButtonElement[];
  /** Every control shows the query CodeMirror actually searches with, even after reopening. */
  const sync = (state: EditorState) => {
    const query = getSearchQuery(state);
    if (document.activeElement !== field && field.value !== query.search)
      field.value = query.search;
    if (document.activeElement !== replaceField && replaceField.value !== query.replace)
      replaceField.value = query.replace;
    for (const node of toggles)
      node.setAttribute('aria-pressed', String(!!query[node.dataset.option as 'regexp']));
    const invalid = !!query.search && !query.valid;
    field.setAttribute('aria-invalid', String(invalid));
    for (const action of actions) action.disabled = invalid || !query.search;
    count.textContent = invalid ? 'Invalid pattern' : matchCount(state, query);
    count.dataset.empty = String(invalid || count.textContent === 'No results');
  };
  sync(view.state);
  return {
    dom: root,
    top: true,
    mount: () => {
      field.focus();
      field.select();
      // Reopened with a query: land on a match (after the caret, else the first) as "1 of N".
      const query = getSearchQuery(view.state);
      const { from, to } = view.state.selection.main;
      if (!query.search || !query.valid) return;
      const first = query.getCursor(view.state, from).next();
      const match = first.done ? query.getCursor(view.state).next() : first;
      if (!match.done && (match.value.from !== from || match.value.to !== to))
        view.dispatch({
          selection: { anchor: match.value.from, head: match.value.to },
          scrollIntoView: true,
        });
    },
    update: (update: ViewUpdate) => {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.transactions.some((tr) => tr.effects.some((effect) => effect.is(setSearchQuery)))
      )
        sync(update.state);
    },
  };
};
