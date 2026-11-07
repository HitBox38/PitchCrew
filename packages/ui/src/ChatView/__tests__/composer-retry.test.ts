import { beforeEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  beginComposerSend,
  changeComposer,
  composerState,
  failComposerSend,
  swapComposerDraft,
  useComposerStore,
} from '../composer-state.ts';
import { composerSubmitMode, effectiveComposerMode } from '../composer-retry.ts';
import { ComposerSendActions } from '../components/ComposerSendActions.tsx';
import { BrowserReply } from '../../AgentBrowser/components/BrowserReply.tsx';
import type { ChatComposerProps } from '../types.ts';
import type { BrowserReplyProps } from '../../AgentBrowser/types.ts';

vi.mock('../components/ComposerRecovery.tsx', () => ({ ComposerRecovery: () => null }));
beforeEach(() => useComposerStore.setState({ threads: {} }));

const restored = (mode: 'queue' | 'interrupt') => {
  changeComposer('retry-thread', 'Keep the original message.', []);
  const operation = beginComposerSend('retry-thread', 'message', mode)!;
  failComposerSend('retry-thread', operation.token, 'Response lost');
  swapComposerDraft('retry-thread', composerState('retry-thread').kept[0].id);
  return operation.payload.submission!.id;
};

const props = {
  thread: 'retry-thread',
  data: {
    roles: [],
    conversations: [{ id: 'retry-thread' }],
    queue: {
      queues: [
        {
          threadId: 'retry-thread',
          requests: [],
          tasks: [],
          runs: [],
          paused: true,
          pauseKind: 'user',
        },
      ],
    },
  },
  busy: false,
  busyElsewhere: false,
  running: [],
  questions: [{ roleId: 'scout', status: 'pending' }],
  available: true,
  working: false,
  readOnly: false,
  participants: ['scout'],
  files: [],
  error: '',
} as unknown as ChatComposerProps & BrowserReplyProps;

it.each(['queue', 'interrupt'] as const)(
  'preserves a restored %s action across preferences, idle/busy states and alternate Enter',
  (retryMode) => {
    const id = restored(retryMode);
    const preferred = retryMode === 'queue' ? 'interrupt' : 'queue';
    const retained = composerState('retry-thread').draft.submission!;
    expect(effectiveComposerMode(preferred, retained.intent)).toBe(retryMode);
    for (const busy of [false, true])
      for (const alternate of [false, true])
        expect(
          composerSubmitMode({ busy, sendMode: preferred, retryMode: retained.intent }, alternate),
        ).toBe(retryMode);
    const retry = beginComposerSend('retry-thread', 'message', preferred)!;
    expect(retry.payload.submission).toEqual({ id, intent: retryMode });
  },
);

it('shows the original interrupt action in both surfaces despite an idle run and held question/queue', () => {
  restored('interrupt');
  const retained = composerState('retry-thread').draft;
  const draft = {
    draft: retained.text,
    draftReferences: retained.references,
    retryMode: retained.submission!.intent,
  };
  const Chat = () => {
    return createElement(ComposerSendActions, {
      ...props,
      ...draft,
      sendMode: effectiveComposerMode('queue', draft.retryMode),
    });
  };
  const ExpandedBrowser = () => {
    return createElement(BrowserReply, {
      ...props,
      ...draft,
      name: 'Scout',
      sendMode: effectiveComposerMode('queue', draft.retryMode),
    });
  };
  for (const component of [Chat, ExpandedBrowser]) {
    const html = renderToStaticMarkup(createElement(component));
    expect(html).toContain('aria-label="Retry original interrupt send"');
    expect(html).toContain('Retry keeps the original Interrupt action.');
    expect(html).toContain('cancels pending questions and resumes the queue');
    expect(html).not.toContain('Queue message for after your answer');
    expect(html).not.toContain('aria-label="Follow-up action"');
  }
});

it('hides the follow-up picker for a retained queued retry even during current work', () => {
  const html = renderToStaticMarkup(
    createElement(ComposerSendActions, {
      ...props,
      draft: 'Same message',
      retryMode: 'queue',
      sendMode: 'queue',
      busy: true,
    }),
  );
  expect(html).toContain('Retry keeps the original Queue action.');
  expect(html).toContain('aria-label="Retry original queued send"');
  expect(html).not.toContain('aria-label="Follow-up action"');
});

it('unlocks fresh action choices after an actual payload edit', () => {
  restored('interrupt');
  changeComposer('retry-thread', 'A changed message.', []);
  const retryMode = composerState('retry-thread').draft.submission?.intent;
  expect(retryMode).toBeUndefined();
  expect(effectiveComposerMode('queue', retryMode)).toBe('queue');
  expect(composerSubmitMode({ busy: true, sendMode: 'queue', retryMode }, true)).toBe('interrupt');
});
