import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { adapters } from '../../adapters/src/index.ts';
import type { Packet, Run, RunContext } from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import { cleanup, finish } from '../../orchestrator/test/helpers/daemon.ts';
import { assessment, deepReviewFixture } from '../../orchestrator/test/helpers/deep-reviews.ts';
import { reviewSummary } from '../../orchestrator/test/helpers/review-summary.ts';
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
  const { request, card } = await deepReviewFixture();
  const original = adapters.demo.run.bind(adapters.demo);
  let checkedChild = false;
  let childLint: Awaited<ReturnType<Client['callTool']>> | undefined;
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    if (context.role.workflow === 'writer') return original(context);
    if (context.deepReview?.subagent) {
      await clientFor(context, async (client) => {
        const names = (await client.listTools()).tools.map((tool) => tool.name);
        expect(names).toContain('pitchcrew_request_review_time');
        const report = await client.callTool({
          name: 'pitchcrew_report_technical_problem',
          arguments: { area: 'documents' },
        });
        expect(report.isError, JSON.stringify(report)).not.toBe(true);
        expect(names).not.toContain('pitchcrew_start_review_subagent');
        expect(names).not.toContain('pitchcrew_extend_review_deadline');
        expect(names).not.toContain('pitchcrew_ask_user');
        expect(names).not.toContain('pitchcrew_invoke_agent');
        expect(names).not.toContain('pitchcrew_export_packet');
        const result = await client.callTool({ name: 'pitchcrew_get_card', arguments: {} });
        expect(JSON.stringify(result)).not.toContain('RAW-SOURCE-DIRECTIVE');
        const payload = result.structuredContent as { card?: { packet?: Packet } } | undefined;
        expect(payload?.card?.packet?.note).toBe('');
        childLint = await client.callTool({
          name: 'pitchcrew_lint_packet',
          arguments: { packet: payload!.card!.packet! },
        });
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
        summary: reviewSummary(),
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
    return {
      role: 'reviewer',
      passed: true,
      feedback: [],
      summary: reviewSummary(),
      assessment: assessment(),
    };
  });
  const run = (await request<Run>(`/cards/${card.id}/deep-reviews`, 'POST', {})).result;
  await finish(request, run.id);
  expect(checkedChild).toBe(true);
  expect(childLint?.isError, JSON.stringify(childLint)).not.toBe(true);
  expect(childLint?.structuredContent).toMatchObject({
    scope: 'resume',
    problems: [],
    documents: { errors: [], reports: [{ name: 'resume.pdf', status: 'verified' }] },
    layout: { resumePages: 1, coverLetterPages: null },
  });
});
it('lints claimless specialist inputs without widening their scope or relaxing parent validation', async () => {
  const { daemon, request, card } = await deepReviewFixture();
  const original = adapters.demo.run.bind(adapters.demo);
  const failures: unknown[] = [];
  let checkedChild = false;
  let checkedParent = false;
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    if (context.role.workflow === 'writer') {
      const result = await original(context);
      if (result.role === 'writer') result.packet.resume = '# Fictional Candidate\n\nEngineer';
      return result;
    }
    try {
      if (context.deepReview?.subagent || context.deepReview?.stage === 'review')
        await clientFor(context, async (client) => {
          const result = await client.callTool({ name: 'pitchcrew_get_card', arguments: {} });
          const packet = (result.structuredContent as { card: { packet: Packet } }).card.packet;
          const lint = (packet: Packet) =>
            client.callTool({ name: 'pitchcrew_lint_packet', arguments: { packet } });
          const direct = (packet: Packet) =>
            daemon.service.agentCall(context.mcp.env.PITCHCREW_RUN_TOKEN!, 'lint', { packet });
          if (context.deepReview?.subagent) {
            expect(packet).toMatchObject({
              coverLetter: '',
              formAnswers: '',
              note: '',
              claims: [],
            });
            expect(await direct(packet)).toMatchObject({ scope: 'resume', problems: [] });
            const checked = await lint(packet);
            expect(checked.isError, JSON.stringify(checked)).not.toBe(true);
            expect(checked.structuredContent).toMatchObject({
              scope: 'resume',
              problems: [],
              documents: { errors: [], reports: [{ name: 'resume.pdf', status: 'verified' }] },
              layout: { coverLetterPages: null },
            });
            for (const field of ['coverLetter', 'formAnswers', 'note'] as const) {
              const expanded = { ...packet, [field]: 'Outside this specialist scope.' };
              expect((await lint(expanded)).isError).toBe(true);
              await expect(direct(expanded)).rejects.toThrow(field);
            }
            for (const resume of ['', 'a'.repeat(20001)]) {
              expect((await lint({ ...packet, resume })).isError).toBe(true);
              await expect(direct({ ...packet, resume })).rejects.toThrow('resume');
            }
            const unsupported = {
              ...packet,
              resume: 'Invented achievement.',
              claims: [
                {
                  claim: 'Invented achievement.',
                  quote: 'Invented achievement.',
                  source: 'profile.md',
                },
              ],
            };
            expect((await lint(unsupported)).structuredContent).toMatchObject({
              problems: ['Source does not support: Invented achievement.'],
            });
            const missing = {
              ...packet,
              claims: [
                {
                  claim: 'Built a React interface.',
                  quote: 'Built a React interface.',
                  source: 'profile.md',
                },
              ],
            };
            expect((await lint(missing)).structuredContent).toMatchObject({
              problems: ['Claim is not included in the packet: Built a React interface.'],
            });
            expect(
              (await lint({ ...packet, resume: 'word '.repeat(651) })).structuredContent,
            ).toMatchObject({
              problems: ['Resume exceeds 650 words.'],
            });
            checkedChild = true;
          } else {
            const checked = await lint(packet);
            expect(checked.isError, JSON.stringify(checked)).not.toBe(true);
            expect(checked.structuredContent).toMatchObject({
              scope: 'packet',
              documents: { reports: [{ name: 'resume.pdf' }, { name: 'cover_letter.pdf' }] },
              layout: { coverLetterPages: 1 },
            });
            expect((await lint({ ...packet, coverLetter: '' })).isError).toBe(true);
            expect((await lint({ ...packet, claims: [] })).isError).toBe(true);
            await expect(
              daemon.service.agentCall(context.mcp.env.PITCHCREW_RUN_TOKEN!, 'lint', {
                packet: { ...packet, coverLetter: '' },
                scope: 'resume',
              }),
            ).rejects.toThrow('coverLetter');
            expect(
              (await lint({ ...packet, coverLetter: 'word '.repeat(501) })).structuredContent,
            ).toMatchObject({
              problems: expect.arrayContaining(['Cover letter exceeds 500 words.']),
            });
            checkedParent = true;
          }
        });
    } catch (error) {
      // The workflow records optional child failures; retain assertion failures for the test.
      failures.push(error);
    }
    return original(context);
  });
  const run = (
    await request<Run>(`/cards/${card.id}/deep-reviews`, 'POST', {
      secondOpinions: true,
      requestedPerspectives: ['impact'],
    })
  ).result;
  await vi.waitFor(
    () => expect(daemon.service.board.get<Run>('run', run.id).status).not.toBe('running'),
    { timeout: 20000 },
  );
  if (failures.length) throw failures[0];
  expect(checkedChild).toBe(true);
  expect(checkedParent).toBe(true);
  const completed = daemon.service.board.get<Run>('run', run.id);
  expect(completed.status, completed.message).toBe('completed');
}, 30000);
it('gives a parent deadline decision extension, diagnostic and application read tools over stdio', async () => {
  const { daemon, request, card } = await deepReviewFixture();
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
            'pitchcrew_report_technical_problem',
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
        const report = await client.callTool({
          name: 'pitchcrew_report_technical_problem',
          arguments: { area: 'runtime' },
        });
        expect(report.isError, JSON.stringify(report)).not.toBe(true);
        decided = true;
      });
      return { role: 'reviewer', passed: true, feedback: [], summary: reviewSummary() };
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
