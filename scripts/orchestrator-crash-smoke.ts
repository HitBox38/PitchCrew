/** Explicit live-provider crash test. Hard-kills only the daemon process tree this script starts. */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ChatRequest,
  ChatSubmissionReceipt,
  Conversation,
  Role,
  Run,
  RunActivity,
  Snapshot,
} from '../packages/core/src/index.ts';

interface CheckpointObservation {
  phase: 'checkpoint';
  runId: string;
  roleId: string;
  runtime: string;
  privacyValid: boolean;
  entries: { id: string; kind: string; status: string }[];
}
const args = process.argv.slice(2);
const argument = (name: string): string => {
  const value = args[args.indexOf(name) + 1];
  assert(args.includes(name) && value && !value.startsWith('--'), `${name} requires a value.`);
  return value;
};
const emit = (value: object) => console.log(`PITCHCREW_CRASH_SMOKE ${JSON.stringify(value)}`);

const serve = async () => {
  const directory = argument('--directory');
  const port = Number(argument('--port'));
  assert(Number.isInteger(port) && port >= 1024 && port <= 65535);
  const { createDaemon } = await import('../packages/orchestrator/src/server.ts');
  const daemon = await createDaemon({
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
  await new Promise<void>((resolve, reject) => {
    daemon.http.once('error', reject);
    daemon.http.listen(port, '127.0.0.1', () => {
      daemon.http.off('error', reject);
      resolve();
    });
  });
  emit({ phase: 'ready', pid: process.pid });
  const seen = new Map<string, string>();
  const timer = setInterval(() => {
    const rows = daemon.service.board.db
      .prepare('SELECT run_id,json FROM run_activity_checkpoints')
      .all() as { run_id: string; json: string }[];
    for (const row of rows) {
      const run = daemon.service.board.get<Run>('run', row.run_id);
      if (
        run.status !== 'running' ||
        !run.roleId.startsWith('crash-smoke-') ||
        seen.get(run.id) === row.json
      )
        continue;
      seen.set(run.id, row.json);
      const checkpoint = JSON.parse(row.json) as {
        entries: Record<string, unknown>[];
        truncated: boolean;
      };
      const keys = new Set(['id', 'kind', 'label', 'text', 'status', 'startedAt', 'finishedAt']);
      const privacyValid =
        checkpoint.entries.length <= 80 &&
        checkpoint.entries.every(
          (entry) =>
            Object.keys(entry).every((key) => keys.has(key)) &&
            typeof entry.id === 'string' &&
            entry.id.length <= 160 &&
            typeof entry.label === 'string' &&
            entry.label.length <= 160 &&
            (entry.text === undefined ||
              (entry.kind === 'commentary' &&
                typeof entry.text === 'string' &&
                entry.text.length <= 4000)),
        );
      emit({
        phase: 'checkpoint',
        runId: run.id,
        roleId: run.roleId,
        runtime: run.runtime,
        privacyValid,
        entries: checkpoint.entries.map((entry) => ({
          id: entry.id,
          kind: entry.kind,
          status: entry.status,
        })),
      });
    }
  }, 50);
  process.stdin.setEncoding('utf8');
  let stopping = false;
  process.stdin.on('data', (value: string) => {
    if (!value.includes('stop') || stopping) return;
    stopping = true;
    clearInterval(timer);
    void daemon.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  });
};

const unusedPort = async () => {
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
  assert(
    process.platform === 'win32',
    'This process-tree crash harness currently supports Windows only.',
  );
  assert(
    process.versions.bun,
    'Start this script with Bun so its daemon and MCP use the same runtime.',
  );
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-crash-orchestration-'));
  const port = await unusedPort();
  const url = `http://127.0.0.1:${port}`;
  console.log(`Fictional crash-smoke workspace: ${directory}`);
  const report = {
    startedAt: new Date().toISOString(),
    finishedAt: null as string | null,
    status: 'running',
    bun: process.versions.bun,
    checks: [] as string[],
    checkpoints: [] as CheckpointObservation[],
    limitation:
      'Tests recovery of the last persisted public checkpoint, not updates in the uncommitted ten-second window or browser UX.',
  };
  let child: ChildProcess | undefined;
  const owned = new Set<ChildProcess>();
  const observations = new Map<string, CheckpointObservation>();
  let cookie = '';
  const killTree = async (target: ChildProcess) => {
    assert(
      owned.has(target) && target.pid && target.exitCode === null && target.signalCode === null,
      'Refusing to kill an unowned or exited process.',
    );
    await new Promise<void>((resolve, reject) => {
      const killer = spawn(
        join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe'),
        ['/PID', String(target.pid), '/T', '/F'],
        { windowsHide: true, stdio: 'ignore' },
      );
      killer.once('error', reject);
      killer.once('close', (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`Owned process-tree termination failed: ${code}`)),
      );
    });
    if (target.exitCode === null && target.signalCode === null)
      await new Promise<void>((resolve) => target.once('close', () => resolve()));
    owned.delete(target);
  };
  const launch = async () => {
    observations.clear();
    const target = spawn(
      process.execPath,
      [
        '--no-env-file',
        '--no-install',
        fileURLToPath(import.meta.url),
        '--run',
        '--serve',
        '--directory',
        directory,
        '--port',
        String(port),
      ],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: process.env },
    );
    child = target;
    owned.add(target);
    let buffer = '';
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Isolated daemon did not become ready in 90 seconds.')),
        90_000,
      );
      const fail = () => {
        clearTimeout(timer);
        reject(new Error('Isolated daemon exited before readiness.'));
      };
      target.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      target.once('close', fail);
      target.stdout!.setEncoding('utf8');
      target.stdout!.on('data', (chunk: string) => {
        buffer += chunk;
        let newline: number;
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          if (!line.startsWith('PITCHCREW_CRASH_SMOKE ')) continue;
          const event = JSON.parse(line.slice('PITCHCREW_CRASH_SMOKE '.length)) as
            | { phase: 'ready' }
            | CheckpointObservation;
          if (event.phase === 'ready') {
            clearTimeout(timer);
            target.off('close', fail);
            resolve();
          } else if (event.phase === 'checkpoint') observations.set(event.roleId, event);
        }
      });
      // No raw provider stderr is copied into the evidence report.
      target.stderr!.resume();
    });
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    cookie = response.headers.get('set-cookie')?.split(';')[0] ?? '';
    await response.arrayBuffer();
    assert(cookie, 'No local UI session after daemon start.');
  };
  const request = async <T>(path: string, method = 'GET', body?: unknown): Promise<T> => {
    const response = await fetch(`${url}/api${path}`, {
      method,
      headers: { cookie, 'x-pitchcrew-client': 'ui', 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30_000),
    });
    const value = (await response.json()) as T;
    assert(response.ok, `${method} ${path} returned ${response.status}.`);
    return value;
  };
  try {
    await launch();
    const snapshot = await request<Snapshot>('/snapshot');
    for (const runtime of ['codex', 'claude-code'])
      assert(
        snapshot.runtimes.some((entry) => entry.id === runtime && entry.available),
        `${runtime} unavailable; no fallback.`,
      );
    assert(!snapshot.runtimes.some((entry) => entry.id === 'demo'));
    await request('/profile', 'PUT', {
      name: 'smoke.md',
      content:
        '# Fictional crash test\n\nThis is synthetic test data. No real person is represented.\n',
    });
    const { customCapabilities } = await import('../packages/core/src/index.ts');
    const targets = [
      { id: 'crash-smoke-codex', runtime: 'codex', model: 'gpt-6.1-sol' },
      { id: 'crash-smoke-claude', runtime: 'claude-code', model: 'claude-opus-5-5' },
    ];
    const submissions = await Promise.all(
      targets.map(async (target) => {
        await request<Role>('/roles', 'POST', {
          ...target,
          name: target.id,
          description: 'Isolated fictional hard-crash verification.',
          enabled: true,
          workflow: 'chat',
          reasoning: null,
          capabilities: customCapabilities,
          instructions:
            'Follow the requested synthetic check using only pitchcrew_read_profile and pitchcrew_report_progress. No other tools, questions, memory, or workspace changes. Follow the structured chat response contract.',
        });
        const conversation = await request<Conversation>('/conversations', 'POST', {
          title: target.id,
          participants: [target.id],
        });
        const payload = {
          clientRequestId: randomUUID(),
          content:
            'First call pitchcrew_read_profile and then pitchcrew_report_progress with content "Verified the synthetic profile; preparing fictional analysis". Then write a detailed 1800-word fictional incident analysis of a tea kettle that refuses to boil. Keep all characters, events and evidence fictional. Use no further tools or questions. This long answer is intentional so a test controller can interrupt this disposable run.',
        };
        const accepted = await request<ChatRequest>(
          `/conversations/${conversation.id}/messages`,
          'POST',
          payload,
        );
        return { ...target, conversation, payload, requestId: accepted.id };
      }),
    );
    const deadline = Date.now() + 120_000;
    let captured: CheckpointObservation[] = [];
    while (Date.now() < deadline) {
      const current = await request<Snapshot>('/snapshot');
      const runs = current.runs.filter((entry) =>
        submissions.some((submission) => entry.requestId === submission.requestId),
      );
      assert(
        !runs.some((entry) => entry.status !== 'running'),
        'A real provider settled before a usable active checkpoint could be captured.',
      );
      const candidates = submissions.flatMap((submission) => observations.get(submission.id) ?? []);
      if (
        runs.length === 2 &&
        candidates.length === 2 &&
        candidates.some((checkpoint) =>
          checkpoint.entries.some((entry) => entry.status === 'running'),
        )
      ) {
        assert(
          candidates.every(
            (checkpoint) => checkpoint.privacyValid && checkpoint.entries.length > 0,
          ),
          'Unexpected private/raw fields or empty public checkpoints.',
        );
        captured = candidates;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(
      captured.length,
      2,
      'Did not capture real public checkpoints while both actual providers were active.',
    );
    report.checkpoints = captured;
    console.log(
      'Captured public checkpoints with an unfinished step while both actual runtimes were active; hard-killing owned daemon tree.',
    );
    assert(child);
    await killTree(child);
    child = undefined;
    await launch();
    const recovered = await request<Snapshot>('/snapshot');
    for (const submission of submissions) {
      const checkpoint = captured.find((entry) => entry.roleId === submission.id)!;
      const runs = recovered.runs.filter((entry) => entry.requestId === submission.requestId);
      assert.equal(runs.length, 1);
      const run = runs[0]!;
      assert.equal(
        run.status,
        'failed',
        'Interrupted provider was not reconciled as a failed run.',
      );
      assert(run.activity?.length && !run.activity.some((entry) => entry.status === 'running'));
      for (const prior of checkpoint.entries) {
        const restored: RunActivity | undefined = run.activity.find(
          (entry) => entry.id === prior.id,
        );
        assert(restored, 'A persisted public activity entry was lost after hard crash.');
        assert.equal(restored.status, prior.status === 'running' ? 'interrupted' : prior.status);
        assert(
          restored.kind === 'commentary' || restored.text === undefined,
          'Nonpublic text was persisted.',
        );
      }
      const receipt = await request<{ request: ChatSubmissionReceipt | null }>(
        `/conversations/${submission.conversation.id}/messages/receipts/${submission.payload.clientRequestId}`,
      );
      assert.equal(receipt.request?.id, submission.requestId);
      const replay = await request<ChatRequest>(
        `/conversations/${submission.conversation.id}/messages`,
        'POST',
        submission.payload,
      );
      assert.equal(replay.id, submission.requestId);
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const afterReplay = await request<Snapshot>('/snapshot');
    assert.equal(afterReplay.runs.length, 2, 'Receipt replay launched new work after hard crash.');
    assert(afterReplay.runs.every((entry) => entry.status === 'failed'));
    report.status = 'passed';
    report.checks = [
      'two actual providers active before hard process-tree kill',
      'durable bounded public checkpoints inspected before kill',
      'persisted unfinished steps recovered as interrupted',
      'active runs reconciled as failed after hard crash',
      'receipts preserved and exact replay launched no new work',
      'checkpoint fields exclude raw tool payloads and private reasoning text',
    ];
    console.log(
      'PASS: actual Codex and Opus 5.5 hard-crash recovery, interrupted public steps and receipt replay verified.',
    );
  } catch (error) {
    report.status = 'failed';
    throw error;
  } finally {
    if (child && owned.has(child) && child.exitCode === null && child.signalCode === null) {
      const target = child;
      target.stdin!.end('stop\n');
      const closed = await Promise.race([
        new Promise<boolean>((resolve) => target.once('close', () => resolve(true))),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000)),
      ]);
      if (!closed) await killTree(target);
    }
    report.finishedAt = new Date().toISOString();
    await writeFile(
      join(directory, 'crash-smoke-result.json'),
      JSON.stringify(report, null, 2) + '\n',
      'utf8',
    );
    console.log(`Sanitized crash evidence: ${join(directory, 'crash-smoke-result.json')}`);
  }
};

if (!args.includes('--run'))
  console.log(
    'Opt-in Windows hard-crash smoke (two billed actual provider calls): bun --no-env-file --no-install scripts/orchestrator-crash-smoke.ts --run',
  );
else if (args.includes('--serve')) await serve();
else await run();
