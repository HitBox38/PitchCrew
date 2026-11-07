import { randomUUID } from 'node:crypto';
import type {
  ConversationSession,
  RuntimeAuthInteraction,
  RuntimeAuthMethod,
  RuntimeAuthResponse,
  RuntimeAuthState,
  RuntimeId,
} from '@pitchcrew/core';
import {
  adapters,
  findRuntimeExecutable,
  maintenanceDefinitions,
  startNativeRuntimeSignIn,
  supportsNativeSignIn,
  nativeRuntimeAuthMethods,
  nativeRuntimeCanLogout,
  nativeRuntimeAuthCredentialScope,
  discoverNativeRuntimeAuthMethods,
  startNativeRuntimeSignOut,
  type NativeSignInProcess,
} from '@pitchcrew/adapters';
import type { CrewContext } from '../crew/types.ts';
import { drainConversationQueue } from '../crew/conversation-queue.ts';
import { runtimeSignInFailure } from './auth-errors.ts';

export const runtimeAuthHost = {
  executable: findRuntimeExecutable,
  start: startNativeRuntimeSignIn,
  logout: startNativeRuntimeSignOut,
  methods: discoverNativeRuntimeAuthMethods,
  detect: (id: RuntimeId) => adapters[id].detect(),
  now: () => Date.now(),
};
const connectionRecovery =
  'Authentication settings cannot be read. Recover authentication settings below before signing in.';
interface SignInEntry {
  state: RuntimeAuthState;
  controller: AbortController;
  completion: Promise<void>;
  process?: NativeSignInProcess;
  operation: 'login' | 'logout';
}

/** Native credentials stay with the CLI. This memory-only state is served only to user sessions. */
export class RuntimeAuthManager {
  readonly host: typeof runtimeAuthHost;
  private readonly entries = new Map<RuntimeId, SignInEntry>();
  private readonly discovered = new Map<RuntimeId, RuntimeAuthMethod[]>();
  private readonly discoveryTasks = new Map<RuntimeId, Promise<RuntimeAuthMethod[]>>();
  private readonly discoveryControllers = new Map<RuntimeId, AbortController>();
  constructor(
    readonly context: () => CrewContext,
    host: Partial<typeof runtimeAuthHost> = {},
  ) {
    this.host = { ...runtimeAuthHost, ...host };
  }
  private scope = <T>(runtime: RuntimeId, action: () => T): T => {
    const context = this.context();
    const run = () => context.runtimeSetup.withExecutables(action);
    return context.runtimeConnections
      ? context.runtimeConnections.withEnvironment(runtime, run)
      : run();
  };
  methods = (runtime: RuntimeId): RuntimeAuthMethod[] =>
    structuredClone(this.discovered.get(runtime) ?? nativeRuntimeAuthMethods(runtime));
  discoverMethods = (runtime: RuntimeId): Promise<RuntimeAuthMethod[]> => {
    const pending = this.discoveryTasks.get(runtime);
    if (pending) return pending;
    const context = this.context(),
      manager = context.runtimeMaintenance;
    if (
      runtime !== 'grok' ||
      context.closing ||
      manager.isUpdating(runtime) ||
      manager.busy(runtime).length ||
      !context.runtimes.some((item) => item.id === runtime && item.available)
    )
      return Promise.resolve(this.methods(runtime));
    try {
      this.scope(runtime, () => {});
    } catch {
      return Promise.reject(new Error(connectionRecovery));
    }
    const controller = new AbortController();
    this.discoveryControllers.set(runtime, controller);
    let reservation: Promise<void>;
    const request = Promise.resolve()
      .then(() =>
        this.scope(runtime, async () => {
          await context.runtimeConnections?.authenticationDirectory(runtime);
          const command = await this.host.executable(maintenanceDefinitions.grok.command);
          return command
            ? this.host.methods(runtime, {
                command,
                signal: AbortSignal.any([manager.controller.signal, controller.signal]),
                onAction: () => {},
                timeout: 10_000,
              })
            : nativeRuntimeAuthMethods(runtime);
        }),
      )
      .then((methods) => {
        if (!controller.signal.aborted) this.discovered.set(runtime, methods);
        return structuredClone(methods);
      })
      .finally(() => {
        this.discoveryTasks.delete(runtime);
        this.discoveryControllers.delete(runtime);
        if (manager.active.get(runtime) === reservation) manager.active.delete(runtime);
        if (!context.closing) {
          void Promise.resolve()
            .then(() => drainConversationQueue(context))
            .catch(() => {});
          void Promise.resolve()
            .then(() => context.drainTasks())
            .catch(() => {});
        }
      });
    reservation = request.then(
      () => {},
      () => {},
    );
    this.discoveryTasks.set(runtime, request);
    manager.active.set(runtime, reservation);
    return request;
  };
  current = (runtime: RuntimeId): RuntimeAuthState => {
    const state: RuntimeAuthState = this.entries.get(runtime)?.state ?? {
      runtime,
      supported: supportsNativeSignIn(runtime),
      id: null,
      stage: 'idle',
      detail: supportsNativeSignIn(runtime)
        ? runtime === 'codex'
          ? 'Connect Codex to ChatGPT in your browser.'
          : runtime === 'claude-code'
            ? 'Connect Claude Code to your Claude account in your browser.'
            : 'Use the selected native sign-in method below.'
        : 'Use this runtime’s native sign-in instructions or configure its authentication variables below, then recheck.',
      startedAt: null,
      expiresAt: null,
      finishedAt: null,
    };
    let canLogout = false,
      configurationError: string | undefined;
    try {
      canLogout = this.scope(runtime, () => nativeRuntimeCanLogout(runtime));
    } catch {
      configurationError = connectionRecovery;
    }
    return structuredClone({
      ...state,
      methods: this.methods(runtime),
      credentialScope: nativeRuntimeAuthCredentialScope(runtime),
      canLogout,
      ...(configurationError ? { configurationError } : {}),
    });
  };
  start = (runtime: RuntimeId, methodId?: string): RuntimeAuthState =>
    this.begin(runtime, methodId, 'login');
  logout = (runtime: RuntimeId): RuntimeAuthState => this.begin(runtime, undefined, 'logout');
  private begin = (
    runtime: RuntimeId,
    methodId: string | undefined,
    operationType: 'login' | 'logout',
  ): RuntimeAuthState => {
    try {
      this.scope(runtime, () => {});
    } catch {
      throw new Error(connectionRecovery);
    }
    const selected =
      operationType === 'login'
        ? this.methods(runtime).find((method) => (methodId ? method.id === methodId : true))
        : undefined;
    if (operationType === 'login' && !selected)
      throw new Error('Use this runtime’s CLI sign-in instructions.');
    if (operationType === 'logout' && !this.scope(runtime, () => nativeRuntimeCanLogout(runtime)))
      throw new Error(
        'This runtime does not offer native sign-out for its current authentication.',
      );
    const previous = this.entries.get(runtime);
    if (previous && !previous.state.finishedAt) {
      if (
        previous.operation !== operationType ||
        (methodId && previous.state.methodId !== methodId)
      )
        throw new Error('Finish or cancel the current authentication operation first.');
      return this.current(runtime);
    }
    const context = this.context();
    if (context.closing) throw new Error('The workspace is closing.');
    if (!context.runtimes.some((entry) => entry.id === runtime && entry.available))
      throw new Error('Install a compatible runtime and recheck before signing in.');
    const manager = context.runtimeMaintenance;
    if (manager.isUpdating(runtime))
      throw new Error('Wait for runtime setup or maintenance to finish.');
    const busy = manager.busy(runtime);
    if (busy.length) throw new Error(`Wait for this runtime to become idle. ${busy.join(' ')}`);
    const started = this.host.now();
    const entry: SignInEntry = {
      state: {
        runtime,
        supported: true,
        methodId: selected?.id,
        operation: operationType,
        id: randomUUID(),
        stage: 'starting',
        detail:
          operationType === 'logout'
            ? 'Signing out of the native CLI…'
            : 'Starting native sign-in…',
        startedAt: new Date(started).toISOString(),
        expiresAt: null,
        finishedAt: null,
      },
      controller: new AbortController(),
      completion: Promise.resolve(),
      operation: operationType,
    };
    this.entries.set(runtime, entry);
    // Reserve synchronously, before resolving the binary or starting any asynchronous child.
    const operation = Promise.resolve()
      .then(async () => {
        try {
          await this.scope(runtime, () => this.execute(entry));
        } catch {
          entry.state.stage = 'failed';
          entry.state.detail = connectionRecovery;
          delete entry.state.url;
          delete entry.state.codeRequested;
          delete entry.state.interaction;
          entry.state.finishedAt = new Date(this.host.now()).toISOString();
        }
      })
      .finally(() => {
        if (manager.active.get(runtime) === operation) manager.active.delete(runtime);
        if (!context.closing) {
          void Promise.resolve()
            .then(() => drainConversationQueue(context))
            .catch(() => {});
          void Promise.resolve()
            .then(() => context.drainTasks())
            .catch(() => {});
        }
      });
    entry.completion = operation;
    manager.active.set(runtime, operation);
    return this.current(runtime);
  };
  private execute = async (entry: SignInEntry) => {
    const context = this.context(),
      runtime = entry.state.runtime;
    let invalidated = false;
    try {
      const command = await this.host.executable(
        maintenanceDefinitions[runtime as Exclude<RuntimeId, 'demo'>].command,
      );
      entry.controller.signal.throwIfAborted();
      if (!command)
        throw new Error('The runtime executable is unavailable. Recheck its installation.');
      // Invalidate old sessions before the CLI can change credentials. A failed write
      // must prevent sign-in from starting, including across a later daemon restart.
      try {
        this.invalidate(runtime);
      } catch {
        throw new Error('Workspace storage is unavailable. Sign-in did not start.');
      }
      if (runtime === 'grok') await context.runtimeConnections?.authenticationDirectory(runtime);
      entry.state.expiresAt = new Date(this.host.now() + 5 * 60_000).toISOString();
      entry.process = (entry.operation === 'logout' ? this.host.logout : this.host.start)(runtime, {
        command,
        methodId: entry.state.methodId,
        signal: entry.controller.signal,
        onAction: (action) => {
          if (entry.controller.signal.aborted) return;
          const previous = entry.state.interaction;
          Object.assign(entry.state, action, {
            stage: 'waiting',
            detail: action.codeRequested
              ? 'Finish sign-in in your browser, then paste its one-time code below.'
              : runtime === 'codex'
                ? 'Open the sign-in page and finish with ChatGPT.'
                : action.interaction?.type === 'terminal'
                  ? 'Complete sign-in in the native terminal below.'
                  : 'Finish native sign-in in your browser.',
          });
          if (action.url && !action.codeRequested && previous?.type !== 'code')
            entry.state.interaction = {
              id:
                previous?.type === 'browser' && previous.url === action.url
                  ? previous.id
                  : randomUUID(),
              type: 'browser',
              url: action.url,
            };
          if (action.codeRequested === true && previous?.type !== 'code')
            entry.state.interaction = {
              id: randomUUID(),
              type: 'code',
              label: 'Code from the sign-in page',
            };
          if (action.codeRequested === false && previous?.type === 'code') {
            delete entry.state.interaction;
            delete entry.state.url;
            entry.state.stage = 'verifying';
            entry.state.detail = 'Waiting for the native CLI to finish sign-in…';
          }
        },
      });
      await entry.process.completion;
      entry.controller.signal.throwIfAborted();
      delete entry.state.url;
      delete entry.state.codeRequested;
      delete entry.state.interaction;
      entry.state.stage = 'verifying';
      entry.state.expiresAt = null;
      entry.state.detail = 'Checking native account readiness…';
      this.invalidate(runtime);
      invalidated = true;
      const health = await this.host.detect(runtime);
      context.runtimes = context.runtimes.map((item) =>
        item.id === runtime ? { ...item, ...health } : item,
      );
      const authentication = await context.runtimeMaintenance.authenticate(
        { runtime, model: '' },
        true,
      );
      entry.controller.signal.throwIfAborted();
      if (!health.available)
        throw new Error(
          'Native sign-in ended, but Pitchcrew could not verify account readiness. Recheck or use the CLI instructions.',
        );
      if (entry.operation === 'logout') {
        entry.state.stage = authentication.status === 'authenticated' ? 'completed' : 'succeeded';
        entry.state.detail =
          authentication.status === 'authenticated'
            ? 'The CLI finished sign-out, but authentication is still configured. Recheck the active account and authentication variables.'
            : 'Native sign-out completed. Saved conversation history is kept.';
      } else if (authentication.status === 'authenticated') {
        entry.state.stage = 'succeeded';
        entry.state.detail =
          'Signed in. Native account readiness was verified without a model request.';
      } else if (authentication.status === 'unknown') {
        entry.state.stage = 'completed';
        entry.state.detail =
          'The CLI finished sign-in. Account readiness remains unverified without a model request; recheck or start work when ready.';
      } else
        throw new Error(
          'Native sign-in ended, but Pitchcrew could not verify account readiness. Recheck or use the CLI instructions.',
        );
    } catch (error) {
      entry.state.stage = entry.controller.signal.aborted ? 'cancelled' : 'failed';
      entry.state.detail = entry.controller.signal.aborted
        ? 'Sign-in cancelled. Recheck to confirm the CLI’s current account.'
        : entry.operation === 'logout'
          ? 'Sign-out could not be completed. Recheck the CLI’s current account before continuing.'
          : runtimeSignInFailure(error);
    } finally {
      try {
        // A cancelled OAuth flow can race with a browser callback. Clear cached readiness.
        if (entry.process && (!invalidated || entry.controller.signal.aborted))
          this.invalidate(runtime);
      } catch {
        entry.state.stage = 'failed';
        entry.state.detail =
          'Sign-in stopped, but workspace storage is unavailable. Recheck before continuing.';
      } finally {
        delete entry.process;
        delete entry.state.url;
        delete entry.state.codeRequested;
        delete entry.state.interaction;
        entry.state.finishedAt = new Date(this.host.now()).toISOString();
      }
    }
  };
  private invalidate = (runtime: RuntimeId) => {
    const context = this.context();
    context.modelCatalogs.delete(runtime);
    context.runtimeMaintenance.clearAuthentication(runtime);
    for (const session of context.board.list<ConversationSession>('conversation_session'))
      if (session.runtime === runtime && !session.invalid)
        context.board.record(
          'conversation_session',
          { ...session, invalid: true },
          'user',
          'Invalidated session after native sign-in',
        );
  };
  cancel = async (runtime: RuntimeId, flowId: string): Promise<RuntimeAuthState> => {
    const entry = this.flow(runtime, flowId);
    if (!entry.state.finishedAt) {
      entry.controller.abort();
      await entry.completion;
    }
    return this.current(runtime);
  };
  respond = (runtime: RuntimeId, flowId: string, code: string): RuntimeAuthState => {
    const entry = this.flow(runtime, flowId);
    if (entry.state.stage !== 'waiting' || !entry.state.codeRequested || !entry.process)
      throw new Error('This sign-in is not waiting for a code.');
    if (typeof code !== 'string' || !/^[\x21-\x7e]{1,2048}$/.test(code.trim()))
      throw new Error('Paste the single-line code shown by the provider.');
    entry.process.respond(code.trim());
    delete entry.state.interaction;
    delete entry.state.codeRequested;
    delete entry.state.url;
    entry.state.stage = 'verifying';
    entry.state.detail = 'Waiting for the native CLI to finish sign-in…';
    return this.current(runtime);
  };
  respondInteraction = (
    runtime: RuntimeId,
    flowId: string,
    interactionId: string,
    response: RuntimeAuthResponse,
  ): RuntimeAuthState => {
    const entry = this.flow(runtime, flowId);
    const interaction = entry.state.interaction;
    if (
      entry.state.stage !== 'waiting' ||
      !entry.process ||
      !interaction ||
      interaction.id !== interactionId
    )
      throw new Error('This sign-in interaction is no longer active.');
    this.validateResponse(interaction, response);
    if (response.type === 'code') return this.respond(runtime, flowId, response.code);
    if (response.type === 'browser' && response.action === 'decline') entry.controller.abort();
    else if (
      response.type !== 'browser' ||
      (interaction.type === 'browser' && interaction.requiresConsent)
    ) {
      if (!entry.process.respondInteraction)
        throw new Error('This native sign-in cannot accept this response.');
      entry.process.respondInteraction(response);
      if (
        response.type === 'browser' &&
        entry.state.interaction?.id === interactionId &&
        entry.state.interaction.type === 'browser'
      )
        entry.state.interaction.requiresConsent = false;
      if (response.type === 'credentials' && entry.state.interaction?.id === interactionId) {
        delete entry.state.interaction;
        entry.state.stage = 'verifying';
        entry.state.detail = 'Waiting for the native CLI to finish sign-in…';
      }
    }
    return this.current(runtime);
  };
  private validateResponse = (
    interaction: RuntimeAuthInteraction,
    response: RuntimeAuthResponse,
  ) => {
    if (interaction.type !== response.type)
      throw new Error('This response does not match the current sign-in request.');
    if (response.type === 'terminal') {
      if (
        typeof response.data !== 'string' ||
        response.data.length > 4096 ||
        response.data.includes('\0')
      )
        throw new Error('The terminal response is invalid or too large.');
      const size = response.size;
      if (
        size &&
        (!Number.isInteger(size.cols) ||
          !Number.isInteger(size.rows) ||
          size.cols < 1 ||
          size.cols > 500 ||
          size.rows < 1 ||
          size.rows > 200)
      )
        throw new Error('The sign-in terminal size is invalid.');
    }
    if (response.type === 'credentials' && interaction.type === 'credentials') {
      const fields = new Set(interaction.fields.map((field) => field.name));
      if (
        Object.keys(response.values).some((name) => !fields.has(name)) ||
        Object.values(response.values).some(
          (value) => typeof value !== 'string' || value.length > 16_384 || /[\r\n\0]/.test(value),
        )
      )
        throw new Error('The credential response does not match the current sign-in fields.');
    }
  };
  private flow = (runtime: RuntimeId, id: string): SignInEntry => {
    const entry = this.entries.get(runtime);
    if (!entry || entry.state.id !== id)
      throw new Error('This sign-in has expired. Start a new sign-in.');
    return entry;
  };
  close = async () => {
    const entries = [...this.entries.values()];
    for (const entry of entries) if (!entry.state.finishedAt) entry.controller.abort();
    for (const controller of this.discoveryControllers.values()) controller.abort();
    await Promise.allSettled([
      ...entries.map((entry) => entry.completion),
      ...this.discoveryTasks.values(),
    ]);
    this.entries.clear();
    this.discovered.clear();
  };
}
