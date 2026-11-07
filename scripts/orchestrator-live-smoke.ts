/** Opt-in, billed live-provider smoke. Uses a fresh fictional production workspace, never Demo. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  ChatRequest,
  ChatSubmissionReceipt,
  Conversation,
  Role,
  Run,
  Snapshot,
} from '../packages/core/src/index.ts';

const args = process.argv.slice(2);
const option = (name: string, fallback: string): string => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};

const unusedPort = async (): Promise<number> => {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert(address && typeof address === 'object');
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
};

const run = async () => {
  const port = Number(option('--port', String(await unusedPort())));
  assert(Number.isInteger(port) && port >= 1024 && port <= 65535, 'Invalid loopback port.');
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-live-orchestration-'));
  console.log(`Fictional smoke workspace: ${directory}`);
  const report = {
    startedAt: new Date().toISOString(),
    finishedAt: null as string | null,
    bun: process.versions.bun ?? null,
    node: process.versions.node,
    status: 'running',
    checks: [] as string[],
    runtimes: [] as { runtime: string; model: string; runId: string }[],
    limitation: 'Graceful restart only; not a process-kill crash test or a browser UX check.',
  };
  const { createDaemon } = await import('../packages/orchestrator/src/server.ts');
  const { customCapabilities } = await import('../packages/core/src/index.ts');
  const start = () =>
    createDaemon({
      directory,
      port,
      dev: false,
      ui: false,
      seedSkills: false,
      analytics: null,
      updates: { enabled: false, automatic: false },
      runtimeUpdateChecks: false,
      runtimeAuthenticationChecks: false,
    });
  let daemon: Awaited<ReturnType<typeof createDaemon>> | undefined;
  let cookie = '';
  const listen = async () => {
    assert(daemon);
    const current = daemon;
    await new Promise<void>((resolve, reject) => {
      current.http.once('error', reject);
      current.http.listen(port, '127.0.0.1', () => {
        current.http.off('error', reject);
        resolve();
      });
    });
    const response = await fetch(current.url);
    cookie = response.headers.get('set-cookie')?.split(';')[0] ?? '';
    await response.arrayBuffer();
    assert(cookie, 'No local UI session.');
  };
  const request = async <T>(path: string, method = 'GET', body?: unknown): Promise<T> => {
    assert(daemon);
    const response = await fetch(`${daemon.url}/api${path}`, {
      method,
      headers: { cookie, 'x-pitchcrew-client': 'ui', 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30_000),
    });
    const value = (await response.json()) as T;
    assert(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(value)}`);
    return value;
  };
  try {
    daemon = await start();
    await listen();
    for (const runtime of ['codex', 'claude-code'])
      assert(
        daemon.service.runtimes.some((entry) => entry.id === runtime && entry.available),
        `${runtime} is unavailable; no replacement runtime will be used.`,
      );
    assert(
      !daemon.service.runtimes.some((entry) => entry.id === 'demo'),
      'Demo appeared in production.',
    );
    const marker = `FICTIONAL-SMOKE-${randomUUID()}`;
    await request('/profile', 'PUT', {
      name: 'smoke.md',
      content: `# Fictional smoke profile\n\nThis is test data, not a real person.\nVerification marker: ${marker}\n`,
    });
    const targets = [
      { id: 'smoke-codex', runtime: 'codex', model: option('--codex-model', 'gpt-6.1-sol') },
      {
        id: 'smoke-claude',
        runtime: 'claude-code',
        model: option('--claude-model', 'claude-opus-5-5'),
      },
    ] as const;
    const submissions = await Promise.all(
      targets.map(async (target) => {
        const role = await request<Role>('/roles', 'POST', {
          ...target,
          name: target.id,
          description: 'Fictional isolated live runtime smoke.',
          workflow: 'chat',
          enabled: true,
          reasoning: null,
          capabilities: customCapabilities,
          instructions:
            'Run only the requested fictional smoke check. Use pitchcrew_read_profile and pitchcrew_report_progress. Do not invoke other tools, ask questions, save memory, or change workspace data. Follow the structured chat response contract.',
        });
        const conversation = await request<Conversation>('/conversations', 'POST', {
          title: `${target.id} live smoke`,
          participants: [role.id],
        });
        const clientRequestId = randomUUID();
        const payload = {
          clientRequestId,
          content: `Execute this short fictional verification: first call pitchcrew_report_progress with content "${target.id}: starting fictional profile check". Then call pitchcrew_read_profile, then pitchcrew_report_progress with content "${target.id}: verified fictional profile". Finally reply with the exact Verification marker from smoke.md and the words "${target.id} completed". Use only those tools; do not ask any questions.`,
        };
        // Concurrent exact replays must return one request and dispatch one provider turn.
        const [first, duplicate] = await Promise.all([
          request<ChatRequest>(`/conversations/${conversation.id}/messages`, 'POST', payload),
          request<ChatRequest>(`/conversations/${conversation.id}/messages`, 'POST', payload),
        ]);
        assert.equal(first.id, duplicate.id, 'Concurrent send replay created a second request.');
        const receipt = await request<{ request: ChatSubmissionReceipt | null }>(
          `/conversations/${conversation.id}/messages/receipts/${clientRequestId}`,
        );
        assert.equal(
          receipt.request?.id,
          first.id,
          'Accepted request was not reconciled by receipt.',
        );
        console.log(`${target.runtime} ${target.model}: request accepted once`);
        return { ...target, conversation, payload, requestId: first.id };
      }),
    );
    const deadline = Date.now() + 5 * 60_000;
    let parallelObserved = false;
    let finished: Run[] = [];
    while (Date.now() < deadline) {
      const snapshot = await request<Snapshot>('/snapshot');
      const runs = snapshot.runs.filter((entry) =>
        submissions.some((submission) => submission.requestId === entry.requestId),
      );
      parallelObserved ||= runs.filter((entry) => entry.status === 'running').length === 2;
      for (const entry of runs)
        assert(
          !['failed', 'cancelled', 'waiting'].includes(entry.status),
          `${entry.runtime}: ${entry.status}: ${entry.message}`,
        );
      if (runs.length === 2 && runs.every((entry) => entry.status === 'completed')) {
        finished = runs;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.equal(finished.length, 2, 'Actual provider turns did not finish within five minutes.');
    assert(parallelObserved, 'The two actual provider runs were never observed concurrently.');
    for (const submission of submissions) {
      const runs: Run[] = daemon.service.board
        .list<Run>('run')
        .filter((entry) => entry.requestId === submission.requestId);
      assert.equal(runs.length, 1, 'Duplicate request dispatched more than one provider turn.');
      const run = runs[0]!;
      assert(
        run.activity?.some(
          (entry) => entry.label === 'Reading profile' && entry.status === 'completed',
        ),
        `${submission.runtime}: scoped profile MCP call was not observed.`,
      );
      assert(
        run.activity?.some(
          (entry) =>
            entry.kind === 'commentary' &&
            entry.text?.includes(`${submission.id}: verified fictional profile`),
        ),
        `${submission.runtime}: public progress MCP call was not observed.`,
      );
      const reply = daemon.service.board
        .list<import('../packages/core/src/index.ts').ChatMessage>('message')
        .find((entry) => entry.runId === run.id && entry.from === submission.id);
      assert(
        reply?.content.includes(marker),
        `${submission.runtime}: fictional profile marker missing from final answer.`,
      );
      console.log(
        `${submission.runtime}: completed with scoped MCP profile read and public progress`,
      );
      report.runtimes.push({ runtime: submission.runtime, model: submission.model, runId: run.id });
    }
    const savedActivity = new Map(
      finished.map((entry) => [
        entry.id,
        JSON.stringify(daemon!.service.board.get<Run>('run', entry.id).activity),
      ]),
    );
    await daemon.close();
    daemon = undefined;
    daemon = await start();
    await listen();
    for (const submission of submissions) {
      const receipt = await request<{ request: ChatSubmissionReceipt | null }>(
        `/conversations/${submission.conversation.id}/messages/receipts/${submission.payload.clientRequestId}`,
      );
      assert.equal(receipt.request?.id, submission.requestId, 'Receipt did not survive restart.');
      const replay = await request<ChatRequest>(
        `/conversations/${submission.conversation.id}/messages`,
        'POST',
        submission.payload,
      );
      assert.equal(
        replay.id,
        submission.requestId,
        'Replay after restart created another request.',
      );
      const runs: Run[] = daemon.service.board
        .list<Run>('run')
        .filter((entry) => entry.requestId === submission.requestId);
      assert.equal(runs.length, 1, 'Replay after restart launched another provider turn.');
      assert.equal(
        JSON.stringify(runs[0]!.activity),
        savedActivity.get(runs[0]!.id),
        'Saved public activity changed during restart.',
      );
    }
    console.log(
      'PASS: actual Codex and Claude ran in parallel; duplicate sends, receipt lookup, saved public activity and restart replay verified.',
    );
    console.log(
      'This is a graceful-restart smoke, not a process-kill crash test or a full browser UX check.',
    );
    report.status = 'passed';
    report.checks = [
      'two actual runtimes observed concurrently',
      'concurrent sends deduplicated',
      'receipt lookup before and after restart',
      'scoped profile and public progress MCP calls',
      'final reply contains fictional profile marker',
      'public activity persisted',
      'replay after restart did not launch another run',
    ];
  } catch (error) {
    report.status = 'failed';
    throw error;
  } finally {
    await daemon?.close();
    report.finishedAt = new Date().toISOString();
    await writeFile(
      join(directory, 'smoke-result.json'),
      JSON.stringify(report, null, 2) + '\n',
      'utf8',
    );
    console.log(`Evidence retained in ${directory}`);
  }
};

if (!args.includes('--run')) {
  console.log(
    'Opt-in live smoke (uses installed provider accounts and may incur charges):\n' +
      'bun --no-env-file --no-install scripts/orchestrator-live-smoke.ts --run\n' +
      'Optional: --codex-model <id> --claude-model <id> --port <1024-65535>\n' +
      'Defaults: gpt-6.1-sol and claude-opus-5-5. Keeps its temporary fictional workspace as evidence.',
  );
} else {
  await run();
}
