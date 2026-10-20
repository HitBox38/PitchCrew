import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { adapters } from '../../adapters/src/index.ts';
import type { Run, RunContext } from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import { cleanup, finish } from '../../orchestrator/test/helpers/daemon.ts';
import { assessment, deepReviewFixture } from '../../orchestrator/test/helpers/deep-reviews.ts';
const clientFor = async (context: RunContext, run: (client: Client) => Promise<void>) => {
  const client = new Client({ name: 'fictional-deep-review-test', version: '1.0.0' });
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [
          '--import',
          import.meta.resolve('tsx'),
          fileURLToPath(new URL('../src/cli.ts', import.meta.url)),
        ],
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).filter(
              (entry): entry is [string, string] => entry[1] !== undefined,
            ),
          ),
          ...context.mcp.env,
        },
        stderr: 'pipe',
      }),
    );
    await run(client);
  } finally {
    await client.close();
  }
};

afterEach(cleanup);
it('exposes distinct parent and child review tools over actual MCP stdio without granting native or crew tools', async () => {
  const { request, card } = await deepReviewFixture(24531);
  const original = adapters.demo.run.bind(adapters.demo);
  let checkedChild = false;
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    if (context.role.workflow === 'writer') return original(context);
    if (context.deepReview?.subagent) {
      await clientFor(context, async (client) => {
        const names = (await client.listTools()).tools.map((tool) => tool.name);
        expect(names).toContain('pitchcrew_request_review_time');
        expect(names).not.toContain('pitchcrew_start_review_subagent');
        expect(names).not.toContain('pitchcrew_extend_review_deadline');
        expect(names).not.toContain('pitchcrew_ask_user');
        expect(names).not.toContain('pitchcrew_invoke_agent');
        expect(names).not.toContain('pitchcrew_export_packet');
        const result = await client.callTool({ name: 'pitchcrew_get_card', arguments: {} });
        expect(JSON.stringify(result)).not.toContain('RAW-SOURCE-DIRECTIVE');
        const payload = result.structuredContent as
          | { card?: { packet?: { note?: string } } }
          | undefined;
        expect(payload?.card?.packet?.note).toBe('');
        const time = await client.callTool({
          name: 'pitchcrew_request_review_time',
          arguments: { minutes: 5, reason: 'Need more time for this targeted evidence check.' },
        });
        expect(time.isError, JSON.stringify(time)).not.toBe(true);
        checkedChild = true;
      });
      return {
        role: 'reviewer',
        passed: true,
        feedback: [],
        assessment: {
          ...assessment(),
          perspectives: [
            {
              ...assessment().perspectives[0]!,
              perspective: context.deepReview.subagent.perspective,
            },
          ],
        },
      };
    }
    if (context.deepReview?.stage === 'review')
      await clientFor(context, async (client) => {
        const names = (await client.listTools()).tools.map((tool) => tool.name);
        expect(names).toContain('pitchcrew_start_review_subagent');
        expect(names).toContain('pitchcrew_extend_review_deadline');
        expect(names).not.toContain('pitchcrew_invoke_agent');
        expect(names).not.toContain('pitchcrew_export_packet');
        const started = await client.callTool({
          name: 'pitchcrew_start_review_subagent',
          arguments: {
            perspective: 'impact',
            focus: 'Inspect the supported impact evidence.',
            reason: 'Need a targeted second opinion about impact.',
          },
        });
        expect(started.isError, JSON.stringify(started)).not.toBe(true);
        for (let i = 0; i < 10; i++) {
          const state = await client.callTool({
            name: 'pitchcrew_review_subagents',
            arguments: { waitMs: 1000 },
          });
          expect(state.isError, JSON.stringify(state)).not.toBe(true);
          const payload = state.structuredContent as
            | { subagents?: { status: string }[] }
            | undefined;
          if (
            payload?.subagents?.length === 1 &&
            payload.subagents.every((child) => child.status !== 'running')
          )
            break;
        }
        expect(checkedChild).toBe(true);
      });
    return { role: 'reviewer', passed: true, feedback: [], assessment: assessment() };
  });
  const run = (await request<Run>(`/cards/${card.id}/deep-reviews`, 'POST', {})).result;
  await finish(request, run.id);
  expect(checkedChild).toBe(true);
});
it('gives a parent deadline decision only the extension tool and application reads over stdio', async () => {
  const { daemon, request, card } = await deepReviewFixture(24532);
  const original = adapters.demo.run.bind(adapters.demo);
  let decided = false;
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    if (context.deepReview?.budgetRequest) {
      await clientFor(context, async (client) => {
        const names = (await client.listTools()).tools.map((tool) => tool.name).sort();
        expect(names).toEqual(
          [
            'pitchcrew_extend_review_deadline',
            'pitchcrew_get_card',
            'pitchcrew_get_packet_rules',
            'pitchcrew_lint_packet',
            'pitchcrew_read_profile',
          ].sort(),
        );
        expect(
          (
            await client.callTool({
              name: 'pitchcrew_extend_review_deadline',
              arguments: context.deepReview!.budgetRequest,
            })
          ).isError,
        ).not.toBe(true);
        decided = true;
      });
      return { role: 'reviewer', passed: true, feedback: [] };
    }
    if (context.deepReview?.subagent)
      await daemon.service.agentCall(context.mcp.env.PITCHCREW_RUN_TOKEN!, 'request_review_time', {
        minutes: 5,
        reason: 'Need more time to complete this supported targeted opinion.',
      });
    return original(context);
  });
  const run = (
    await request<Run>(`/cards/${card.id}/deep-reviews`, 'POST', {
      secondOpinions: true,
      requestedPerspectives: ['impact'],
    })
  ).result;
  // Four Demo stages plus a real MCP process can exceed finish's short poll budget.
  await vi.waitFor(
    () => expect(daemon.service.board.get<Run>('run', run.id).status).not.toBe('running'),
    { timeout: 10000 },
  );
  const completed = daemon.service.board.get<Run>('run', run.id);
  expect(completed.status, completed.message).toBe('completed');
  expect(decided).toBe(true);
});
