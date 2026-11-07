import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import type { ChatMessage, Role } from '@pitchcrew/core';
import { ReferenceMessage } from '../components/ReferenceMessage.tsx';

const catalog = { roles: [{ id: 'career-coach', name: 'Career Coach' } as Role], skills: [] };
const body =
  '\n\n| Direction | Fit |\n|---|---|\n| Frontend | Strong |\n\n- [x] Evidence checked\n- [ ] Follow up\n\n~~Removed claim~~';
const render = (content: string, user = false) =>
  renderToStaticMarkup(
    createElement(ReferenceMessage, {
      message: {
        id: 'message',
        threadId: 'thread',
        from: user ? 'user' : 'scout',
        to: 'user',
        cardId: null,
        runId: null,
        createdAt: '2026-11-06T00:00:00Z',
        content,
        ...(user
          ? {
              references: [
                {
                  kind: 'agent',
                  id: 'career-coach',
                  label: 'Career Coach',
                  token: '@career-coach',
                  start: 0,
                  end: 13,
                },
              ],
            }
          : {}),
      } as ChatMessage,
      catalog,
      streaming: false,
    }),
  );

it.each([false, true])(
  'preserves GFM tables, tasks and strike-through with resolved mentions (user=%s)',
  (user) => {
    const html = render('@career-coach Please check this.' + body, user);
    expect(html).toContain('chat-reference-agent');
    expect(html).toContain('<table');
    expect(html).toContain('<th');
    expect(html).toContain('aria-label="Completed item"');
    expect(html).toContain('aria-label="Incomplete item"');
    expect(html).toContain('<del>Removed claim</del>');
  },
);

it('preserves GFM beside a file citation and leaves undecorated replies unchanged', () => {
  const cited = render('[Resume](pitchcrew-file:profile/resume.md)' + body);
  expect(cited).toContain('chat-reference-file');
  for (const html of [cited, render('Plain reply.' + body)]) {
    expect(html).toContain('<table');
    expect(html).toContain('aria-label="Completed item"');
    expect(html).toContain('<del>Removed claim</del>');
  }
});
