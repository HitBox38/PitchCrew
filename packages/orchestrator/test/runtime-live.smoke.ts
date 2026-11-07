/** Manual, credit-spending integration check. Never included by the automated test glob. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import type {
  ChatMessage,
  ChatRequest,
  Conversation,
  ConversationSession,
  Role,
  Run,
  RuntimeMaintenanceState,
  RuntimeModelCatalog,
} from '@pitchcrew/core';

if (!process.argv.includes('--live')) {
  console.log(
    'Manual live-provider check. Run with pinned Bun and --live to spend four runtime turns.',
  );
  process.exit(process.argv.includes('--help') ? 0 : 2);
}

const main = async () => {
  const [{ createDaemon }, { Board }, { defaultCapabilities }] = await Promise.all([
    import('../src/server.ts'),
    import('@pitchcrew/board'),
    import('@pitchcrew/core'),
  ]);
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-runtime-live-'));
  const resultPath = join(directory, 'result.json');
  // Keep default roles paused and avoid startup model recommendations for unrelated providers.
  const seed = new Board(join(directory, 'pitchcrew.db'));
  seed.seedRoles('codex', false);
  seed.close();
  const socket = createServer();
  await new Promise<void>((resolve) => socket.listen(0, '127.0.0.1', resolve));
  const address = socket.address();
  assert(address && typeof address !== 'string');
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    socket.close((error) => (error ? reject(error) : resolve())),
  );
  let daemon: Awaited<ReturnType<typeof createDaemon>> | undefined;
  let phase = 'startup';
  const phases: Array<Record<string, unknown>> = [];
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 5 * 60_000);
  const progress = (next: string) => {
    phase = next;
    console.log(JSON.stringify({ phase }));
    controller.signal.throwIfAborted();
  };
  let passed = false;
  let noJobsCreated = false;
  try {
    daemon = await createDaemon({
      directory,
      port,
      dev: false,
      ui: false,
      seedSkills: false,
      runtimeAuthenticationChecks: true,
      runtimeUpdateChecks: false,
      analytics: null,
    });
    await new Promise<void>((resolve) => daemon!.http.listen(port, '127.0.0.1', resolve));
    const session = await fetch(daemon.url, { signal: controller.signal });
    const cookie = session.headers.get('set-cookie')?.split(';')[0];
    assert(cookie, 'A real local user session is required.');
    const request = async <T>(path: string, method = 'GET', body?: unknown): Promise<T> => {
      controller.signal.throwIfAborted();
      const response = await fetch(`${daemon!.url}/api${path}`, {
        method,
        signal: controller.signal,
        headers: {
          cookie,
          origin: daemon!.url,
          'x-pitchcrew-client': 'ui',
          'content-type': 'application/json',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} during ${phase}.`);
      return (await response.json()) as T;
    };
    const observedProfiles = new Set<string>();
    const originalAgentCall = daemon.service.agentCall;
    daemon.service.agentCall = async (token, action, data) => {
      const runId = daemon!.service.capabilities.get(token)?.runId;
      const result = await originalAgentCall(token, action, data);
      if (action === 'profile' && runId) observedProfiles.add(runId);
      return result;
    };
    const marker = `PROFILE_${randomUUID()}`;
    await request('/profile', 'PUT', {
      name: 'live-check.md',
      content: `# Fictional integration profile\nRuntime live smoke marker: ${marker}\nNo real candidate or employer information.`,
    });
    const capabilities = Object.fromEntries(
      Object.keys(defaultCapabilities).map((name) => [name, false]),
    );
    const waitForRun = async (requestId: string): Promise<Run> => {
      const turnDeadline = Date.now() + 120_000;
      while (Date.now() < turnDeadline) {
        controller.signal.throwIfAborted();
        const queued = daemon!.service.board.get<ChatRequest>('chat_request', requestId);
        const delivery = queued.deliveries[0];
        if (delivery?.runId) {
          const run = daemon!.service.board.get<Run>('run', delivery.runId);
          if (run.status !== 'running') {
            assert.equal(
              run.status,
              'completed',
              `Runtime turn status: ${run.status}; inspect the retained workspace.`,
            );
            return run;
          }
        }
        if (delivery && ['failed', 'cancelled', 'paused'].includes(delivery.status))
          throw new Error(`Queue delivery ${delivery.status}; inspect the retained workspace.`);
        await pause(250, undefined, { signal: controller.signal });
      }
      throw new Error('Runtime turn exceeded the 120-second live check deadline.');
    };
    for (const runtime of ['codex', 'claude-code'] as const) {
      progress(`${runtime}:readiness`);
      const health = daemon.service.runtimes.find((entry) => entry.id === runtime);
      assert(health?.available, `${runtime} must already be installed.`);
      const maintenance = await request<RuntimeMaintenanceState>(
        `/runtimes/${runtime}/recheck`,
        'POST',
        { model: '' },
      );
      const readiness = maintenance.authentication.find(
        (entry) => entry.runtime === runtime && entry.model === '',
      )?.result.status;
      assert.equal(
        readiness,
        'authenticated',
        `${runtime} must already be signed in; the check never initiates login.`,
      );
      progress(`${runtime}:models`);
      const catalog = await request<RuntimeModelCatalog>(`/runtimes/${runtime}/models`, 'POST', {
        refresh: true,
      });
      const preferred =
        runtime === 'codex'
          ? catalog.models.find((model) => model.value === 'gpt-6.1-sol')
          : (catalog.models.find((model) => model.value === 'sonnet') ??
            catalog.models.find((model) => /sonnet/i.test(model.value)));
      const model = preferred?.value ?? '';
      const reasoning = preferred?.reasoning?.levels.includes('low') ? 'low' : null;
      const roleId = `live-${runtime}`;
      const role = await request<Role>('/roles', 'POST', {
        id: roleId,
        name: `Live ${runtime}`,
        description: 'Isolated manual runtime integration check.',
        workflow: 'chat',
        runtime,
        model,
        reasoning,
        enabled: false,
        capabilities,
        instructions:
          'Perform only the explicit bounded integration check. Never create or change jobs, send messages, invoke other agents, use connectors or browsers, or request changes. Return the structured chat reply the runtime prompt requires.',
      });
      await request(`/roles/${roleId}`, 'PUT', { ...role, enabled: true });
      const conversation = await request<Conversation>('/conversations', 'POST', {
        title: `Live ${runtime} check`,
        participants: [roleId],
      });
      const checkpoint = `CHECKPOINT_${randomUUID()}`;
      progress(`${runtime}:first-turn`);
      const firstRequest = await request<ChatRequest>(
        `/conversations/${conversation.id}/messages`,
        'POST',
        {
          content: `This is a short integration check. Call pitchcrew_read_profile exactly once. Return a brief reply containing the Runtime live smoke marker from that profile and this checkpoint: ${checkpoint}. Do not use other tools or take other actions.`,
        },
      );
      const first = await waitForRun(firstRequest.id);
      assert(observedProfiles.has(first.id), 'The real scoped MCP profile call must succeed.');
      const firstReply: ChatMessage | undefined = daemon.service.board
        .list<ChatMessage>('message')
        .find((message) => message.runId === first.id && message.from === roleId);
      assert(firstReply, 'The first turn must save an agent reply.');
      assert(
        firstReply.content.includes(marker) && firstReply.content.includes(checkpoint),
        'The first reply must contain both expected markers.',
      );
      const sessions = () =>
        daemon!.service.board
          .list<ConversationSession>('conversation_session')
          .filter((entry) => entry.threadId === conversation.id && entry.roleId === roleId);
      const initialSession = sessions().at(-1);
      assert(
        initialSession?.nativeId &&
          !initialSession.invalid &&
          initialSession.lastMessageId === firstReply.id,
      );
      progress(`${runtime}:resumed-turn`);
      const secondRequest = await request<ChatRequest>(
        `/conversations/${conversation.id}/messages`,
        'POST',
        {
          content:
            'Do not call any tools. Reply only with the checkpoint token from your previous answer. It is intentionally not restated here.',
        },
      );
      assert.notEqual(secondRequest.id, firstRequest.id);
      const second = await waitForRun(secondRequest.id);
      assert.notEqual(second.id, first.id);
      const secondReply: ChatMessage | undefined = daemon.service.board
        .list<ChatMessage>('message')
        .find((message) => message.runId === second.id && message.from === roleId);
      assert(secondReply, 'The continued turn must save an agent reply.');
      assert(
        secondReply.content.includes(checkpoint),
        'The continued turn must recover its checkpoint.',
      );
      const continuedSession = sessions().at(-1);
      assert(continuedSession && !continuedSession.invalid);
      assert.equal(continuedSession.nativeId, initialSession.nativeId);
      assert.equal(continuedSession.directoryId, initialSession.directoryId);
      assert.equal(continuedSession.lastMessageId, secondReply.id);
      phases.push({
        runtime,
        version: health.version,
        readiness,
        catalogSource: catalog.modelSource,
        catalogCount: catalog.models.length,
        model: model || 'CLI default',
        reasoning,
        firstRun: first.id,
        secondRun: second.id,
        profileMcpObserved: true,
        replyMarkerMatched: true,
        nativeSessionReused: true,
      });
      await request(`/roles/${roleId}`, 'PUT', { ...role, enabled: false });
      progress(`${runtime}:passed`);
    }
    assert.equal(daemon.service.board.list('card').length, 0);
    noJobsCreated = true;
    assert.equal(
      daemon.service.board.list<Role>('role').some((role) => role.runtime === 'demo'),
      false,
    );
    passed = true;
  } finally {
    controller.abort();
    clearTimeout(deadline);
    if (daemon) await daemon.close();
    await writeFile(
      resultPath,
      JSON.stringify(
        {
          passed,
          phase,
          checks: phases,
          noJobsCreated,
          nativeAccountChangedByHarness: false,
          notes: [
            'Pitchcrew data and fictional inputs are isolated.',
            'Native CLIs may retain ordinary session/cache state or refresh their existing account.',
            'Profile content is also part of the normal chat prompt; observed MCP gateway completion proves tool use.',
          ],
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    console.log(JSON.stringify({ passed, phase, evidence: resultPath }));
  }
};

void main().catch(() => {
  console.error('Live runtime check failed; inspect the retained temporary workspace.');
  process.exitCode = 1;
});
