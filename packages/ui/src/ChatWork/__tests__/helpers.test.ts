import { expect, it, vi } from 'vitest';
import type { Snapshot } from '@pitchcrew/core';
import type { ChatWorkProps } from '../types.ts';
import { getChatWorkModel, proposalAct } from '../helpers.ts';

it('posts a proposal decision through the given action and leaves its errors to it', async () => {
  const action = vi.fn(async () => undefined);
  proposalAct(action)('/proposals/proposal/decide', { approved: true });
  expect(action).toHaveBeenCalledWith('/proposals/proposal/decide', 'POST', { approved: true });
  const failing = vi.fn(async () => {
    throw new Error('Shown by the workspace');
  });
  expect(
    proposalAct(failing)('/skill-proposals/skill/decide', { approved: false }),
  ).toBeUndefined();
  // The rejection is handled: nothing surfaces as an unhandled promise.
  await Promise.resolve();
  expect(failing).toHaveBeenCalledWith('/skill-proposals/skill/decide', 'POST', {
    approved: false,
  });
});

it('gives Crew work the same act', () => {
  const action = vi.fn(async () => undefined);
  const model = getChatWorkModel({
    data: { roles: [{ id: 'writer', name: 'Writer' }] } as Snapshot,
    tasks: [],
    action,
  } as unknown as ChatWorkProps);
  model.act('/proposals/proposal/decide', { approved: false });
  expect(action).toHaveBeenCalledWith('/proposals/proposal/decide', 'POST', { approved: false });
  expect(model.name('writer')).toBe('Writer');
});
