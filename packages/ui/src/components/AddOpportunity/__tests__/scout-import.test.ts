import type { MouseEvent } from 'react';
import type { Role, Snapshot } from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { useScoutJobImport } from '../hooks/useScoutJobImport.ts';
import { scoutJobPrompt } from '../link-actions.ts';

const setup = (overrides: Partial<Role> = {}) => {
  class Input {
    value = 'https://www.linkedin.com/jobs/view/1234567890';
  }
  vi.stubGlobal('HTMLInputElement', Input);
  const input = new Input();
  const action = vi.fn().mockResolvedValue({ id: 'import-chat' });
  const onClose = vi.fn();
  const data = {
    roles: [
      {
        id: 'custom-scout',
        workflow: 'scout',
        enabled: true,
        runtime: 'codex',
        capabilities: { discoverJobs: true },
        ...overrides,
      },
    ],
    runtimes: [{ id: 'codex', available: true }],
  } as Snapshot;
  const controller = useScoutJobImport({ data, action, working: false, onClose });
  const event = {
    currentTarget: { form: { elements: { namedItem: () => input } } },
  } as unknown as MouseEvent<HTMLButtonElement>;
  return { controller, action, onClose, event, input };
};

const { state, navigate } = vi.hoisted(() => ({ state: vi.fn(), navigate: vi.fn() }));
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState: (value: unknown) => [value, state],
  useRef: (value: unknown) => ({ current: value }),
}));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }));
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it('creates an unattached Scout conversation, queues the prompt, then opens it', async () => {
  const { controller, action, onClose, event, input } = setup();
  await controller.askScout(event);
  expect(action.mock.calls).toEqual([
    ['/conversations', 'POST', { title: 'Add job from link', participants: ['custom-scout'] }],
    [
      '/conversations/import-chat/messages',
      'POST',
      {
        content: scoutJobPrompt(input.value),
        intent: 'queue',
      },
    ],
  ]);
  expect(onClose).toHaveBeenCalledOnce();
  expect(navigate).toHaveBeenCalledWith({ to: '/chat/$thread', params: { thread: 'import-chat' } });
  expect(scoutJobPrompt(input.value)).toContain('already on the board');
  expect(scoutJobPrompt(input.value)).toContain('ask me for the posting text');
});

it('ignores repeated clicks while the conversation request is pending', async () => {
  const { controller, action, event } = setup();
  let finish!: (value: unknown) => void;
  action.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = controller.askScout(event);
  await controller.askScout(event);
  expect(action).toHaveBeenCalledOnce();
  finish({ id: 'import-chat' });
  await pending;
  expect(action).toHaveBeenCalledTimes(2);
});

it('accepts an unreadable public page only while it still matches the failed lookup URL', async () => {
  const { controller, action, event, input } = setup();
  input.value = 'https://careers.example.com/jobs/engineer';
  await controller.askScout(event, 'https://careers.example.com/jobs/another');
  expect(action).not.toHaveBeenCalled();
  await controller.askScout(event, input.value);
  expect(action).toHaveBeenCalledTimes(2);
});

it('keeps the dialog on send failure and reuses the created conversation on retry', async () => {
  const { controller, action, onClose, event } = setup();
  action.mockResolvedValueOnce({ id: 'import-chat' }).mockRejectedValueOnce(new Error('Offline'));
  await controller.askScout(event);
  expect(state).toHaveBeenCalledWith('Offline');
  expect(onClose).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
  await controller.askScout(event);
  expect(action.mock.calls.filter(([path]) => path === '/conversations')).toHaveLength(1);
  expect(onClose).toHaveBeenCalledOnce();
});

it.each([{ enabled: false }, { capabilities: undefined }])(
  'does not send when Scout is blocked: %j',
  async (overrides) => {
    const { controller, action, event } = setup(overrides);
    await controller.askScout(event);
    expect(action).not.toHaveBeenCalled();
  },
);

it.each(['javascript:alert(1)', 'https://job-boards.greenhouse.io/example/jobs/123'])(
  'rechecks the current URL before sending: %s',
  async (url) => {
    const { controller, action, event, input } = setup();
    input.value = url;
    await controller.askScout(event);
    expect(action).not.toHaveBeenCalled();
  },
);
