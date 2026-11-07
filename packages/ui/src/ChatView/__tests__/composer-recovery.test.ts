import { beforeEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  beginComposerSend,
  changeComposer,
  composerState,
  failComposerSend,
  offerComposerDraft,
  useComposerStore,
} from '../composer-state.ts';
import { ComposerRecovery } from '../components/ComposerRecovery.tsx';

// SSR otherwise uses Zustand's initial snapshot instead of the prepared recovery state.
vi.mock('../composer-state.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../composer-state.ts')>();
  return {
    ...original,
    useComposerStore: Object.assign(
      (selector: (state: ReturnType<typeof original.useComposerStore.getState>) => unknown) =>
        selector(original.useComposerStore.getState()),
      original.useComposerStore,
    ),
  };
});

beforeEach(() => useComposerStore.setState({ threads: {} }));

it.each(['message', 'delegation'] as const)(
  'offers read-only conversation refresh after an uncertain %s response',
  (kind) => {
    changeComposer('recovery-thread', 'Check the conversation before retrying.', []);
    const operation = beginComposerSend('recovery-thread', kind)!;
    failComposerSend('recovery-thread', operation.token, 'Response lost');
    const state = composerState('recovery-thread');
    expect(state.refreshNeeded).toBe(false);
    expect(!!state.kept[0].payload.submission).toBe(kind === 'message');
    const html = renderToStaticMarkup(
      createElement(ComposerRecovery, { thread: 'recovery-thread' }),
    );
    expect(html).toContain('Refresh conversation');
    expect(html).toContain('Review 1 kept draft');
  },
);

it('keeps an ordinary unsent draft without offering send-recovery refresh', () => {
  changeComposer('recovery-thread', 'An unsent draft', []);
  offerComposerDraft('recovery-thread', 'A new draft');
  const html = renderToStaticMarkup(createElement(ComposerRecovery, { thread: 'recovery-thread' }));
  expect(html).toContain('Review 1 kept draft');
  expect(html).not.toContain('Refresh conversation');
});
