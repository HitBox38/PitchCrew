import { z } from 'zod';
import { join, resolve, sep } from 'node:path';
import { chmod, lstat, mkdir, realpath } from 'node:fs/promises';
import {
  runtimeIds,
  type ConversationSession,
  type RuntimeConnectionState,
  type RuntimeConnectionUpdate,
  type RuntimeId,
} from '@pitchcrew/core';
import {
  runtimeConnectionFields,
  validateRuntimeConnectionValue,
  withRuntimeConnection,
} from '@pitchcrew/adapters';
import type { CrewContext } from '../crew/types.ts';
import { drainConversationQueue } from '../crew/conversation-queue.ts';
import {
  RuntimeConnectionStore,
  RuntimeConnectionConflict,
  RuntimeConnectionReadError,
} from './store.ts';

const updateSchema = z
  .object({
    revision: z.string().uuid(),
    changes: z
      .record(z.string().max(100), z.string().max(16_384).nullable())
      .refine((value) => Object.keys(value).length <= 64),
  })
  .strict();

/** One private connection configuration per runtime and workspace, never agent controlled. */
export class RuntimeConnections {
  readonly store: RuntimeConnectionStore;
  constructor(
    readonly directory: string,
    readonly context: () => CrewContext,
  ) {
    this.store = new RuntimeConnectionStore(directory);
  }
  private realRuntime = (runtime: RuntimeId) => {
    if (runtime === 'demo' || !runtimeIds.includes(runtime))
      throw new Error('Choose a real runtime for authentication settings.');
  };
  revision = (runtime: RuntimeId) => {
    try {
      return this.store.current(runtime).revision;
    } catch (error) {
      if (error instanceof RuntimeConnectionReadError) return 'unreadable';
      throw error;
    }
  };
  withEnvironment = <T>(runtime: RuntimeId, action: () => T): T =>
    withRuntimeConnection(
      runtime,
      this.store.current(runtime).values,
      action,
      resolve(this.directory, 'runtime-auth', runtime),
    );
  authenticationDirectory = async (runtime: RuntimeId): Promise<string> => {
    this.realRuntime(runtime);
    const base = resolve(this.directory, 'runtime-auth'),
      target = join(base, runtime);
    try {
      await mkdir(base, { recursive: true, mode: 0o700 });
      const baseInfo = await lstat(base);
      if (!baseInfo.isDirectory() || baseInfo.isSymbolicLink()) throw new Error();
      await chmod(base, 0o700);
      await mkdir(target, { recursive: true, mode: 0o700 });
      const targetInfo = await lstat(target);
      if (!targetInfo.isDirectory() || targetInfo.isSymbolicLink()) throw new Error();
      const resolvedBase = await realpath(base),
        resolvedTarget = await realpath(target);
      if (!resolvedTarget.startsWith(resolvedBase + sep)) throw new Error();
      await chmod(target, 0o700);
      return target;
    } catch {
      throw new Error(
        'The private runtime authentication folder is unavailable. Check workspace storage before signing in.',
      );
    }
  };
  status = (runtime: RuntimeId): RuntimeConnectionState => {
    this.realRuntime(runtime);
    const manager = this.context().runtimeMaintenance;
    const busyReasons = [
      ...manager.busy(runtime),
      ...(manager.isUpdating(runtime) ? ['Runtime setup or maintenance is in progress.'] : []),
    ];
    let current: ReturnType<RuntimeConnectionStore['current']>;
    try {
      current = this.store.current(runtime);
    } catch (error) {
      if (!(error instanceof RuntimeConnectionReadError)) throw error;
      return {
        runtime,
        revision: '',
        fields: [],
        busyReasons,
        readError: { code: 'unreadable', message: error.message },
      };
    }
    const { revision, values } = current;
    return {
      runtime,
      revision,
      fields: runtimeConnectionFields(runtime).map((field) => {
        const saved = Object.hasOwn(values, field.name);
        const value = saved ? values[field.name] : process.env[field.name];
        const source = saved ? (value ? 'saved' : 'disabled') : value ? 'inherited' : 'unset';
        let invalidValue: RuntimeConnectionState['fields'][number]['invalidValue'];
        if (!saved && !field.secret && value) {
          try {
            validateRuntimeConnectionValue(runtime, field.name, value);
          } catch {
            invalidValue = {
              code: 'invalid_environment',
              message:
                'The daemon value is not valid for this setting and is hidden. Enter a replacement, or change the daemon environment.',
            };
          }
        }
        return {
          ...field,
          source,
          configured: !!value,
          ...(!field.secret && !invalidValue ? { value: value ?? '' } : {}),
          ...(invalidValue ? { invalidValue } : {}),
        };
      }),
      busyReasons,
    };
  };
  recover = (runtime: RuntimeId) => {
    this.realRuntime(runtime);
    if (!this.status(runtime).readError)
      throw new Error('Saved authentication settings are readable. Recovery is not needed.');
    const context = this.context(),
      manager = context.runtimeMaintenance;
    if (context.closing) throw new Error('The workspace is closing.');
    const runtimes = runtimeIds.filter((id) => id !== 'demo');
    if (runtimes.some((id) => manager.isUpdating(id) || manager.busy(id).length))
      throw new Error(
        'Wait for runtime work, setup and checks to finish before recovering shared authentication settings.',
      );
    let backup: string;
    const operation = Promise.resolve()
      .then(() => {
        for (const session of context.board.list<ConversationSession>('conversation_session'))
          if (!session.invalid)
            context.board.record(
              'conversation_session',
              { ...session, invalid: true },
              'user',
              'Invalidated session after recovering runtime authentication settings',
            );
        for (const id of runtimes) {
          context.modelCatalogs.delete(id);
          manager.clearAuthentication(id);
        }
        backup = this.store.resetUnreadable().backup;
      })
      .finally(() => {
        for (const id of runtimes)
          if (manager.active.get(id) === operation) manager.active.delete(id);
      });
    for (const id of runtimes) manager.active.set(id, operation);
    return operation.then(async () => {
      try {
        await context.detect();
      } catch {
        /* The reset is already committed; a failed health refresh cannot undo it. */
      }
      if (!context.closing) {
        void drainConversationQueue(context).catch(() => {});
        void context.drainTasks().catch(() => {});
      }
      return { ...this.status(runtime), backup: backup! };
    });
  };
  configure = (
    runtime: RuntimeId,
    input: RuntimeConnectionUpdate,
  ): Promise<RuntimeConnectionState> => {
    this.realRuntime(runtime);
    const parsed = updateSchema.parse(input);
    for (const [name, value] of Object.entries(parsed.changes)) {
      if (!runtimeConnectionFields(runtime).some((field) => field.name === name))
        throw new Error('This authentication variable is not supported by the selected runtime.');
      if (value !== null) validateRuntimeConnectionValue(runtime, name, value);
    }
    const context = this.context(),
      manager = context.runtimeMaintenance;
    if (context.closing || manager.controller.signal.aborted)
      throw new Error('The workspace is closing.');
    if (manager.isUpdating(runtime))
      throw new Error('Wait for runtime setup or maintenance to finish.');
    const busy = manager.busy(runtime);
    if (busy.length) throw new Error(`Wait for this runtime to become idle. ${busy.join(' ')}`);
    const operation = Promise.resolve()
      .then(() => {
        const current = this.store.current(runtime);
        // Check the optimistic version before invalidating otherwise valid native sessions.
        if (current.revision !== parsed.revision) throw new RuntimeConnectionConflict();
        const values = { ...current.values };
        for (const [name, value] of Object.entries(parsed.changes)) {
          if (value === null) delete values[name];
          else values[name] = value;
        }
        for (const session of context.board.list<ConversationSession>('conversation_session'))
          if (session.runtime === runtime && !session.invalid)
            context.board.record(
              'conversation_session',
              { ...session, invalid: true },
              'user',
              'Invalidated session after runtime authentication settings changed',
            );
        context.modelCatalogs.delete(runtime);
        manager.clearAuthentication(runtime);
        this.store.save(runtime, values, parsed.revision);
      })
      .finally(() => {
        if (manager.active.get(runtime) === operation) manager.active.delete(runtime);
        if (!context.closing) {
          void drainConversationQueue(context);
          void context.drainTasks();
        }
      });
    manager.active.set(runtime, operation);
    return operation.then(() => this.status(runtime));
  };
}

export { RuntimeConnectionConflict } from './store.ts';
