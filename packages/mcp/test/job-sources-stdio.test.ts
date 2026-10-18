import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  defaultCapabilities,
  type JobLinkImportResult,
  type JobScanSummary,
  type Role,
} from '@pitchcrew/core';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { cleanup, resources, setup } from '../../orchestrator/test/helpers/daemon.ts';
import { fixtureSources, recordedBoards } from '../../orchestrator/test/helpers/job-boards.ts';
import { postingLinks, recordedPostings } from '../../orchestrator/test/helpers/job-links.ts';

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

it('exposes scan and link import tools over actual stdio only with discoverJobs and rechecks it per call', async () => {
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
    expect(names).not.toContain('pitchcrew_import_job_link');
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
    const importTool = tools.find((tool) => tool.name === 'pitchcrew_import_job_link');
    expect(importTool).toBeTruthy();
    expect(importTool!.inputSchema.required).toEqual(['url']);
    expect(importTool!.inputSchema.additionalProperties).toBe(false);
    expect(importTool!.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    });
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
    daemon.service.jobSources.fetch = recordedPostings().fetcher;
    const invalidImport = await client.callTool({
      name: 'pitchcrew_import_job_link',
      arguments: { url: postingLinks.greenhouse.link, endpoint: 'https://evil.example' },
    });
    expect(invalidImport.isError).toBe(true);
    const imported = await client.callTool({
      name: 'pitchcrew_import_job_link',
      arguments: { url: postingLinks.greenhouse.link },
    });
    expect(imported.isError).not.toBe(true);
    const { result } = imported.structuredContent as { result: JobLinkImportResult };
    expect(result).toMatchObject({
      status: 'added',
      lead: { company: 'Northwind Labs', title: 'Senior Frontend Engineer' },
    });
    if (result.status !== 'added') throw new Error('Expected an imported lead.');
    const duplicate = await client.callTool({
      name: 'pitchcrew_import_job_link',
      arguments: { url: postingLinks.greenhouse.link },
    });
    expect(duplicate.structuredContent).toEqual({
      result: { status: 'duplicate', duplicates: [{ id: result.lead.id, state: 'lead' }] },
    });
    const publicUrl = 'https://careers.example/jobs/43';
    daemon.service.jobSources.readPage = async () => ({
      url: publicUrl,
      html: '<h1>Engineer at Tailspin</h1><p>Build interfaces.</p>',
    });
    const page = await client.callTool({
      name: 'pitchcrew_import_job_link',
      arguments: { url: publicUrl },
    });
    expect(page.structuredContent).toMatchObject({
      result: { status: 'needs_details', text: expect.stringContaining('Tailspin') },
    });
    const publicImport = await client.callTool({
      name: 'pitchcrew_import_job_link',
      arguments: {
        url: publicUrl,
        details: { company: 'Tailspin', title: 'Engineer', description: 'Build interfaces.' },
      },
    });
    expect(publicImport.isError).not.toBe(true);
    expect(publicImport.structuredContent).toMatchObject({
      result: { status: 'added', lead: { url: publicUrl, company: 'Tailspin' } },
    });
    daemon.service.jobSources.readPage = async () => {
      throw new Error('Fixture unreadable page');
    };
    const updated = await client.callTool({
      name: 'pitchcrew_import_job_link',
      arguments: { url: postingLinks.greenhouse.link, cardId: result.lead.id },
    });
    expect(updated.isError).not.toBe(true);
    expect(updated.structuredContent).toMatchObject({
      result: { status: 'updated', card: { id: result.lead.id } },
    });
    const unsupported = await client.callTool({
      name: 'pitchcrew_import_job_link',
      arguments: { url: 'https://careers.example/jobs/42' },
    });
    expect(unsupported.structuredContent).toMatchObject({ result: { status: 'failed' } });
    setDiscovery(false);
    const revoked = await client.callTool({ name: 'pitchcrew_scan_job_sources', arguments: {} });
    expect(revoked.isError).toBe(true);
    const revokedImport = await client.callTool({
      name: 'pitchcrew_import_job_link',
      arguments: { url: postingLinks.greenhouse.link },
    });
    expect(revokedImport.isError).toBe(true);
  } finally {
    await client.close();
  }
});
