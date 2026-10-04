import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { defaultCapabilities, type JobScanSummary, type Role } from '@pitchcrew/core';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { cleanup, resources, setup } from '../../orchestrator/test/helpers/daemon.ts';
import { fixtureSources, recordedBoards } from '../../orchestrator/test/helpers/job-boards.ts';

afterEach(async () => {
  for (const resource of resources) resource.daemon.service.controllers.delete('stdio-discovery');
  await cleanup();
});

async function connect(url: string) {
  const client = new Client({ name: 'job-discovery-contract-test', version: '1.0.0' });
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
        PITCHCREW_RUN_TOKEN: 'stdio-discovery-token',
      },
      stderr: 'pipe',
    }),
  );
  return client;
}

it('exposes the scan tool over actual stdio only with discoverJobs and rechecks it per call', async () => {
  const { daemon, request } = await setup(15471);
  daemon.service.jobSources.fetch = recordedBoards().fetcher;
  await request('/job-sources', 'POST', fixtureSources.lever);
  const scout = daemon.service.board.get<Role>('role', 'scout');
  daemon.service.board.record(
    'run',
    {
      id: 'stdio-discovery',
      roleId: 'scout',
      cardId: null,
      runtime: 'demo',
      status: 'running',
      mode: 'chat',
      threadId: 'scout',
      message: 'Fictional discovery run',
      startedAt: new Date().toISOString(),
      finishedAt: null,
    },
    'scout',
    'Fixture',
  );
  daemon.service.controllers.set('stdio-discovery', new AbortController());
  daemon.service.capabilities.set('stdio-discovery-token', {
    runId: 'stdio-discovery',
    roleId: 'scout',
    cardId: null,
  });
  const setDiscovery = (discoverJobs: boolean) =>
    daemon.service.board.record(
      'role',
      { ...scout, capabilities: { ...defaultCapabilities, discoverJobs } },
      'user',
      'Fixture discovery setting',
    );

  const disabled = await connect(daemon.url);
  try {
    const names = (await disabled.listTools()).tools.map((tool) => tool.name);
    expect(names).not.toContain('pitchcrew_scan_job_sources');
    expect(names).not.toContain('pitchcrew_list_job_sources');
  } finally {
    await disabled.close();
  }

  setDiscovery(true);
  const client = await connect(daemon.url);
  try {
    const tools = (await client.listTools()).tools;
    const scanTool = tools.find((tool) => tool.name === 'pitchcrew_scan_job_sources');
    expect(scanTool).toBeTruthy();
    expect(Object.keys(scanTool!.inputSchema.properties ?? {})).toEqual(['input']);
    expect(tools.map((tool) => tool.name)).toContain('pitchcrew_list_job_sources');
    const listed = await client.callTool({ name: 'pitchcrew_list_job_sources', arguments: {} });
    expect(listed.isError).not.toBe(true);
    const injected = await client.callTool({
      name: 'pitchcrew_scan_job_sources',
      arguments: { input: { url: 'https://evil.example/jobs' } },
    });
    expect(injected.isError).toBe(true);
    const scanned = await client.callTool({ name: 'pitchcrew_scan_job_sources', arguments: {} });
    expect(scanned.isError).not.toBe(true);
    const { summary } = scanned.structuredContent as { summary: JobScanSummary };
    expect(summary).toMatchObject({ new: 2, failedSources: 0 });
    expect(summary.newLeads[0].excerpt).not.toContain('<');
    setDiscovery(false);
    const revoked = await client.callTool({ name: 'pitchcrew_scan_job_sources', arguments: {} });
    expect(revoked.isError).toBe(true);
  } finally {
    await client.close();
  }
});
