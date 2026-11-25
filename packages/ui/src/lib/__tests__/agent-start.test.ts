import { describe, expect, it } from 'vitest';
import type { Conversation, Snapshot } from '@pitchcrew/core';
import { headStartBlock, requestStartBlock, startBlock } from '../agent-start.ts';
import { ago, delivery, queue, request, roles, snapshot } from './attention-fixture.ts';
import { runtime } from './crew-lens-fixture.ts';

// Why an agent cannot start its work, by the checks the server makes when a slot frees.

const scout = roles.find((role) => role.id === 'scout')!;
const signedOut = (model: string): Snapshot['runtimeMaintenance'] => ({
  enabled: true,
  automatic: false,
  checking: false,
  nextCheckAt: null,
  updates: [],
  authentication: [
    {
      runtime: 'demo',
      model,
      result: { status: 'missing', detail: '', checkedAt: ago(2), instructions: '' },
    },
  ],
});

describe('startBlock', () => {
  it('names a paused or retired agent, then a missing runtime, then a missing sign-in', () => {
    const data = snapshot({ runtimes: [runtime('demo')] });
    expect(startBlock(data, scout)).toBeUndefined();
    expect(startBlock(data, { ...scout, enabled: false })).toEqual({
      kind: 'paused',
      title: 'Paused',
      until: 'after you resume Scout in Crew',
    });
    expect(startBlock(data, { ...scout, retiredAt: ago(5) })?.kind).toBe('paused');
    // A runtime this workspace does not list is not installed, as the roster says.
    expect(startBlock(snapshot(), scout)).toEqual({
      kind: 'unavailable',
      title: 'Runtime unavailable',
      until: 'once you install Demo in Settings',
    });
    expect(startBlock(snapshot({ runtimes: [runtime('demo', false)] }), scout)?.kind).toBe(
      'unavailable',
    );
    expect(startBlock({ ...data, runtimeMaintenance: signedOut('') }, scout)).toEqual({
      kind: 'signin',
      title: 'Needs sign-in',
      until: 'once you sign in to Demo in Settings',
    });
    // A sign-in check for another model says nothing about this one.
    expect(startBlock({ ...data, runtimeMaintenance: signedOut('other') }, scout)).toBeUndefined();
  });

  it('reads a conversation’s own runtime for its requests, never for board actions', () => {
    const data = snapshot({
      runtimes: [runtime('demo'), runtime('codex', false)],
      conversations: [
        {
          id: 't-chat',
          configurations: { scout: { runtime: 'codex' } },
        } as unknown as Conversation,
      ],
    });
    expect(requestStartBlock(data, { threadId: 't-chat' }, 'scout')?.until).toBe(
      'once you install Codex in Settings',
    );
    expect(
      requestStartBlock(data, { threadId: 't-chat', boardAction: 'fit' }, 'scout'),
    ).toBeUndefined();
    expect(requestStartBlock(data, { threadId: 't-other' }, 'scout')).toBeUndefined();
    expect(requestStartBlock(data, { threadId: 't-chat' }, 'nobody')).toBeUndefined();
  });

  it('holds a board action, never a chat request, on a runtime that cannot isolate application work', () => {
    const data = snapshot({ runtimes: [{ ...runtime('demo'), applicationIsolation: false }] });
    const fit = { threadId: 't-chat', boardAction: 'fit' as const };
    expect(requestStartBlock(data, fit, 'scout')).toEqual({
      kind: 'isolation',
      title: 'Needs an isolated runtime',
      until: 'once you choose an isolated application runtime for Scout in Crew',
    });
    expect(requestStartBlock(data, { threadId: 't-chat' }, 'scout')).toBeUndefined();
    expect(startBlock(data, scout)).toBeUndefined();
    // As the server checks, a runtime that cannot isolate comes before a missing sign-in.
    const signedOutToo = { ...data, runtimeMaintenance: signedOut('') };
    expect(requestStartBlock(signedOutToo, fit, 'scout')?.kind).toBe('isolation');
  });

  it('holds a queue for the first waiting agent that cannot start its next request', () => {
    const data = snapshot({
      runtimes: [runtime('demo')],
      roles: roles.map((role) => (role.id === 'reviewer' ? { ...role, enabled: false } : role)),
    });
    const head = (deliveries: ReturnType<typeof delivery>[]) =>
      queue('conversation:t-group', {
        requests: [request('group', { threadId: 't-group', deliveries })],
      });
    expect(
      headStartBlock(data, head([delivery('writer', 'queued'), delivery('reviewer', 'queued')])),
    ).toMatchObject({ kind: 'paused', roleId: 'reviewer' });
    // Only queued deliveries wait to start; one already done holds nothing.
    expect(headStartBlock(data, head([delivery('reviewer', 'completed')]))).toBeUndefined();
    expect(headStartBlock(data, queue('job:empty'))).toBeUndefined();
  });
});
