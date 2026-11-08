import { afterEach, expect, it, vi } from 'vitest';
import { browserE2EChat } from './fixtures/browser-e2e-agent.ts';
import type { ChatContext } from '../../core/src/index.ts';

const client = vi.hoisted(() => ({
  callTool: vi.fn(),
  connect: vi.fn(),
  close: vi.fn(),
}));
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: class {
    callTool = client.callTool;
    connect = client.connect;
    close = client.close;
  },
}));
vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: class {},
}));

const context = (): ChatContext => ({
  card: null,
  role: {
    id: 'writer',
    name: 'Writer',
    description: 'Fixture',
    runtime: 'demo',
    model: '',
    enabled: true,
    instructions: 'Fixture',
  },
  profile: [],
  messages: [],
  directory: '/unused-fixture',
  request: 'E2E: click Continue',
  signal: new AbortController().signal,
  mcp: { command: 'unused-fixture-command', args: [], env: {} },
  onMessage: () => {},
});
const failure = (text: string) => ({ isError: true, content: [{ type: 'text', text }] });
const success = (structuredContent: Record<string, unknown>) => ({ structuredContent });
afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

it('waits for the previous run resize before inspecting and requesting a rejectable action', async () => {
  client.callTool
    .mockResolvedValueOnce(failure('A browser action is still finishing.'))
    .mockResolvedValueOnce(success({ page: { digest: 'current-page' } }))
    .mockResolvedValueOnce(success({ approval: { id: 'reviewed-action' } }))
    .mockResolvedValueOnce(
      failure(
        'The user declined this browser action. Do not retry it unless they ask; ask them what to do instead.',
      ),
    );

  await expect(browserE2EChat(context())).resolves.toEqual({
    reply: 'I did not perform the rejected E2E action.',
  });
  expect(client.callTool.mock.calls.map(([call]) => call.name)).toEqual([
    'pitchcrew_computer_inspect',
    'pitchcrew_computer_inspect',
    'pitchcrew_computer_request',
    'pitchcrew_computer_execute',
  ]);
  expect(client.close).toHaveBeenCalledOnce();
});

it('bounds a session lock that never clears without requesting or executing an action', async () => {
  vi.useFakeTimers();
  client.callTool.mockResolvedValue(failure('A browser action is still finishing.'));
  const failed = expect(browserE2EChat(context())).rejects.toThrow(
    'A browser action is still finishing.',
  );
  await vi.advanceTimersByTimeAsync(5000);
  await failed;
  expect(client.callTool.mock.calls.length).toBeGreaterThan(1);
  expect(
    client.callTool.mock.calls.every(([call]) => call.name === 'pitchcrew_computer_inspect'),
  ).toBe(true);
  expect(client.close).toHaveBeenCalledOnce();
});

it('preserves unrelated inspection failures', async () => {
  client.callTool.mockResolvedValue(failure('Browser control is private.'));
  await expect(browserE2EChat(context())).rejects.toThrow('Browser control is private.');
  expect(client.callTool).toHaveBeenCalledOnce();
  expect(client.close).toHaveBeenCalledOnce();
});

it('never retries an execution when the tool reports a busy session', async () => {
  client.callTool
    .mockResolvedValueOnce(success({ page: { digest: 'current-page' } }))
    .mockResolvedValueOnce(success({ approval: { id: 'reviewed-action' } }))
    .mockResolvedValueOnce(failure('A browser action is still finishing.'));
  await expect(browserE2EChat(context())).rejects.toThrow('A browser action is still finishing.');
  expect(client.callTool.mock.calls.map(([call]) => call.name)).toEqual([
    'pitchcrew_computer_inspect',
    'pitchcrew_computer_request',
    'pitchcrew_computer_execute',
  ]);
  expect(client.close).toHaveBeenCalledOnce();
});

it('retains the bounded pre-action request retry when resizing starts after inspection', async () => {
  client.callTool
    .mockResolvedValueOnce(success({ page: { digest: 'current-page' } }))
    .mockResolvedValueOnce(failure('A browser action is in progress.'))
    .mockResolvedValueOnce(success({ approval: { id: 'reviewed-action' } }))
    .mockResolvedValueOnce(failure('Browser action is rejected.'));
  await expect(browserE2EChat(context())).resolves.toEqual({
    reply: 'I did not perform the rejected E2E action.',
  });
  expect(client.callTool.mock.calls.map(([call]) => call.name)).toEqual([
    'pitchcrew_computer_inspect',
    'pitchcrew_computer_request',
    'pitchcrew_computer_request',
    'pitchcrew_computer_execute',
  ]);
});

const viewportError =
  'screenshot: Protocol error (Page.captureScreenshot): The native browser viewport changed. Resize and inspect again.\nCall log:\n  - taking page screenshot\n  - fonts loaded';

it('reinspects and requests fresh evidence when the pre-action screenshot races a resize', async () => {
  client.callTool
    .mockResolvedValueOnce(success({ page: { digest: 'old-viewport' } }))
    .mockResolvedValueOnce(failure(viewportError))
    .mockResolvedValueOnce(success({ page: { digest: 'current-viewport' } }))
    .mockResolvedValueOnce(success({ approval: { id: 'fresh-action' } }))
    .mockResolvedValueOnce(failure('Browser action is rejected.'));
  await expect(browserE2EChat(context())).resolves.toEqual({
    reply: 'I did not perform the rejected E2E action.',
  });
  expect(client.callTool.mock.calls.map(([call]) => call.name)).toEqual([
    'pitchcrew_computer_inspect',
    'pitchcrew_computer_request',
    'pitchcrew_computer_inspect',
    'pitchcrew_computer_request',
    'pitchcrew_computer_execute',
  ]);
});

it('does not replay an action if an execution screenshot reports a viewport change', async () => {
  client.callTool
    .mockResolvedValueOnce(success({ page: { digest: 'current-viewport' } }))
    .mockResolvedValueOnce(success({ approval: { id: 'reviewed-action' } }))
    .mockResolvedValueOnce(failure(viewportError));
  await expect(browserE2EChat(context())).rejects.toThrow('The native browser viewport changed.');
  expect(client.callTool.mock.calls.map(([call]) => call.name)).toEqual([
    'pitchcrew_computer_inspect',
    'pitchcrew_computer_request',
    'pitchcrew_computer_execute',
  ]);
  expect(client.close).toHaveBeenCalledOnce();
});

it('bounds repeated pre-action viewport failures without executing an action', async () => {
  client.callTool.mockImplementation(async ({ name }: { name: string }) =>
    name === 'pitchcrew_computer_inspect'
      ? success({ page: { digest: 'unstable-viewport' } })
      : failure(viewportError),
  );
  await expect(browserE2EChat(context())).rejects.toThrow(
    'The browser evidence kept changing across three fresh requests.',
  );
  const names = client.callTool.mock.calls.map(([call]) => call.name);
  expect(names.filter((name) => name === 'pitchcrew_computer_request')).toHaveLength(3);
  expect(names).not.toContain('pitchcrew_computer_execute');
  expect(client.close).toHaveBeenCalledOnce();
});
