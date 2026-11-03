import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cleanupSkillReaders,
  skillReaderFixture,
} from '../../orchestrator/test/helpers/skill-reader.ts';

const connect = async (url: string, token: string) => {
  const client = new Client({ name: 'skill-reader-test', version: '1.0.0' });
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
        PITCHCREW_DAEMON_URL: url,
        PITCHCREW_RUN_TOKEN: token,
      },
      stderr: 'pipe',
    }),
  );
  return client;
};

afterEach(cleanupSkillReaders);

describe('assigned skill MCP reader', () => {
  it('advertises an ID-only read-only tool and returns exact frozen instructions over actual stdio', async () => {
    const { daemon, service, run, skill, other, input } = await skillReaderFixture(35373);
    const client = await connect(daemon.url, run.id);
    try {
      const tool = (await client.listTools()).tools.find(
        (tool) => tool.name === 'pitchcrew_read_skill',
      );
      expect(tool).toBeDefined();
      expect(Object.keys(tool!.inputSchema.properties ?? {})).toEqual(['skillId']);
      expect(tool!.inputSchema.required).toEqual(['skillId']);
      expect(tool!.inputSchema.additionalProperties).toBe(false);
      expect(tool!.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
      const read = () =>
        client.callTool({ name: 'pitchcrew_read_skill', arguments: { skillId: skill.id } });
      const original = await read();
      expect(original.isError).not.toBe(true);
      expect(original.structuredContent).toMatchObject({
        skill: { id: skill.id, content: input.content },
      });
      service.saveSkill({ ...input, content: 'Changed after the run started.' }, skill.id);
      service.deleteSkill(skill.id);
      expect((await read()).structuredContent).toEqual(original.structuredContent);
      const forbidden = await client.callTool({
        name: 'pitchcrew_read_skill',
        arguments: { skillId: other.id },
      });
      expect(forbidden.isError).toBe(true);
      expect(JSON.stringify(forbidden)).not.toContain(other.content);
      const injected = await client.callTool({
        name: 'pitchcrew_read_skill',
        arguments: { skillId: skill.id, path: '/private/profile.md' },
      });
      expect(injected.isError).toBe(true);
      service.controllers.get(run.id)!.abort();
      expect((await read()).isError).toBe(true);
    } finally {
      await client.close();
    }
  });

  it.each([
    'chat',
    'application-draft',
    'application-review',
    'fit',
    'packet-evaluation',
    'child',
  ] as const)(
    'exposes frozen instruction reading in %s without adding wider application tools',
    async (mode) => {
      const { daemon, run, isolated, updateRun, skill } = await skillReaderFixture(35373);
      if (mode !== 'chat') isolated(mode === 'child' ? 'application-review' : mode);
      if (mode === 'child') updateRun({ deepReviewId: 'review', reviewSubagentId: 'child' });
      const client = await connect(daemon.url, run.id);
      try {
        const names = (await client.listTools()).tools.map((tool) => tool.name);
        expect(names).toContain('pitchcrew_read_skill');
        if (mode !== 'chat') {
          expect(names).not.toContain('pitchcrew_read_messages');
          expect(names).not.toContain('pitchcrew_get_history');
          expect(names).not.toContain('pitchcrew_export_packet');
          expect(names).not.toContain('pitchcrew_list_connectors');
        }
        if (mode === 'child') {
          expect(names).not.toContain('pitchcrew_ask_user');
          expect(names).not.toContain('pitchcrew_notify_user');
        }
        const result = await client.callTool({
          name: 'pitchcrew_read_skill',
          arguments: { skillId: skill.id },
        });
        expect(result.isError).not.toBe(true);
        expect(JSON.stringify(result)).not.toContain('RAW-POSTING-INSTRUCTIONS');
      } finally {
        await client.close();
      }
    },
  );

  it.each(['source', 'budget', 'summary', 'question', 'snapshot'] as const)(
    'omits the reader from actual discovery for %s turns and denies forged calls',
    async (reason) => {
      const { daemon, service, run, isolated, updateRun, summary, skill } =
        await skillReaderFixture(35373);
      if (reason === 'source') updateRun({ purpose: 'source-extraction' });
      if (reason === 'budget') {
        isolated('application-review');
        updateRun({ deepReviewId: 'review', reviewBudgetRequest: true });
      }
      if (reason === 'summary') summary();
      if (reason === 'snapshot') updateRun({ configuration: undefined });
      if (reason === 'question')
        await service.agentCall(run.id, 'ask_user', { question: 'Which example?' });
      // A question ends the turn after the response flushes; keep this fixture alive to inspect
      // startup discovery before testing the server-side denial independently.
      const savedController = service.controllers.get(run.id)!;
      if (reason === 'question') service.controllers.set(run.id, new AbortController());
      const client = await connect(daemon.url, run.id);
      try {
        const listed = await client.listTools();
        expect(listed.tools.map((tool) => tool.name)).not.toContain('pitchcrew_read_skill');
        if (reason === 'source') expect(listed).toEqual({ tools: [] });
        const forged = client.callTool({
          name: 'pitchcrew_read_skill',
          arguments: { skillId: skill.id },
        });
        if (reason === 'source') await expect(forged).rejects.toThrow('Method not found');
        else expect((await forged).isError).toBe(true);
        await expect(
          service.agentCall(run.id, 'read_skill', { input: { skillId: skill.id } }),
        ).rejects.toThrow();
      } finally {
        await client.close();
        if (reason === 'question') service.controllers.set(run.id, savedController);
      }
    },
  );
});
