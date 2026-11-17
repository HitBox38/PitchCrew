import type { RuntimeActivity } from '@pitchcrew/core';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { runAcpText } from '../src/acp.ts';
import { cleanup, contextFor } from './helpers/runtime.ts';

afterEach(cleanup);

it('gives an ACP workflow run only the closed words of each failed call', async () => {
  const onActivity = vi.fn<(entry: RuntimeActivity) => void>();
  const onToolFailure = vi.fn();
  // The fixture's calls: a Pitchcrew call the daemon answered, one the MCP server rejected, and
  // a native command whose failure repeats the run token.
  const context = { ...(await contextFor('kiro-cli', 'tool-calls')), onActivity, onToolFailure };
  await runAcpText(
    process.execPath,
    [fileURLToPath(new URL('./fixtures/acp-cli.ts', import.meta.url))],
    context,
    'Fixture prompt',
  );
  expect(onActivity).not.toHaveBeenCalled();
  expect(onToolFailure).toHaveBeenCalledWith({
    reason: 'invalid_input',
    tool: 'pitchcrew_save_memory',
    kind: 'edit',
  });
  expect(onToolFailure).toHaveBeenCalledWith({ reason: 'tool_error', kind: 'command' });
  expect(JSON.stringify(onToolFailure.mock.calls)).not.toMatch(/PRIVATE_ARG|fictional-token/);
});
