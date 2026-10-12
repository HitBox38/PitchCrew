import {
  roleIdSchema,
  type BrowserFrame,
  type BrowserMode,
  type BrowserSessionInfo,
  type RoleId,
} from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { BrowserDriver } from './types.ts';

type Binding = {
  runId: string;
  roleId: RoleId;
  cardId: string | null;
  threadId?: string;
  taskId?: string;
  mode?: BrowserMode;
};
type Session = {
  info: BrowserSessionInfo;
  driver?: Promise<BrowserDriver>;
  fresh: boolean;
  configure?: boolean;
  timer?: ReturnType<typeof setTimeout>;
  lease?: { id: string; until: number };
  closing: boolean;
};
export class BrowserSessions {
  private readonly agents = new Map<string, Session>();
  private readonly runs = new Map<string, string>();
  constructor(
    private readonly directory: string,
    private readonly launch: (profile?: string) => Promise<BrowserDriver>,
    private readonly idleMs = 10 * 60_000,
  ) {}
  bind(input: Binding) {
    let session = this.agents.get(input.roleId);
    if (!session) {
      session = {
        info: {
          roleId: input.roleId,
          runId: null,
          taskId: '',
          threadId: null,
          cardId: null,
          status: 'closed',
          mode: 'supervised',
          manual: false,
          allowedSites: [],
          url: '',
          title: '',
        },
        fresh: false,
        closing: false,
      };
      this.agents.set(input.roleId, session);
    }
    if (session.closing) throw new Error('Browser is closing. Try again shortly.');
    if (session.info.runId === input.runId) return;
    if (session.info.runId) throw new Error('This agent already has an active browser run.');
    if (
      session.info.threadId !== (input.threadId ?? null) ||
      session.info.cardId !== input.cardId
    ) {
      session.fresh = !!session.driver;
      session.info.url = '';
      session.info.title = '';
    }
    const taskId = input.taskId ?? input.runId;
    if (session.info.taskId !== taskId) session.info.allowedSites = [];
    Object.assign(session.info, {
      runId: input.runId,
      threadId: input.threadId ?? null,
      cardId: input.cardId,
      taskId,
      mode: input.mode ?? 'supervised',
    });
    session.configure = true;
    clearTimeout(session.timer);
    this.runs.set(input.runId, input.roleId);
  }
  forRun(id: string) {
    return this.agents.get(this.runs.get(id) ?? id);
  }
  forRole(id: string) {
    const session = this.agents.get(id);
    if (!session || session.closing) throw new Error('This agent has no open browser.');
    return session;
  }
  list() {
    return [...this.agents.values()].map((session) => ({
      ...session.info,
      allowedSites: [...session.info.allowedSites],
    }));
  }
  assertAgent(id: string) {
    const session = this.forRun(id);
    if (session?.info.manual)
      throw new Error('Manual control is active. Wait for the user to return browser control.');
    if (session?.closing) throw new Error('Browser is closing.');
  }
  async driver(id: string) {
    let session = this.forRun(id);
    if (!session) {
      this.bind({ runId: id, roleId: id, cardId: null });
      session = this.forRun(id)!;
    }
    if (session.closing) throw new Error('Browser is closing.');
    if (!session.driver) {
      const current = session;
      current.driver = this.profile(current.info.roleId)
        .then((path) => this.launch(path))
        .then((driver) => {
          current.info.status = 'open';
          return driver;
        })
        .catch((error) => {
          current.driver = undefined;
          current.info.status = 'closed';
          throw error;
        });
    }
    const driver = await session.driver!;
    if (session.fresh) {
      session.fresh = false;
      await driver.freshPage?.();
    }
    if (session.configure) {
      session.configure = false;
      driver.prepare?.(
        session.info.mode === 'autonomous' && !session.info.manual,
        session.info.allowedSites,
      );
    }
    this.touch(session);
    return driver;
  }
  async frame(roleId: string): Promise<BrowserFrame | null> {
    const session = this.forRole(roleId);
    if (!session.driver) return null;
    const driver = await this.driver(roleId);
    const frame = driver.frame
      ? await driver.frame()
      : { ...(await driver.snapshot()), width: 1280, height: 800 };
    Object.assign(session.info, { url: frame.url, title: frame.title });
    return frame;
  }
  async openRole(roleId: RoleId, threadId: string, cardId: string | null) {
    const existing = this.agents.get(roleId);
    if (
      !existing ||
      (!existing.info.runId &&
        !existing.info.manual &&
        (existing.info.threadId !== threadId || existing.info.cardId !== cardId))
    ) {
      this.bind({ runId: `user:${roleId}`, roleId, threadId, cardId });
      this.stop(`user:${roleId}`);
    }
    await this.driver(roleId);
  }
  take(roleId: string) {
    const session = this.forRole(roleId);
    if (session.info.status !== 'open' || !session.driver)
      throw new Error('Open the browser before taking control.');
    if (session.lease && session.lease.until > Date.now())
      throw new Error('Browser is controlled in another view. Return control there first.');
    session.info.manual = true;
    session.lease = { id: randomUUID(), until: Date.now() + 45_000 };
    this.touch(session);
    return session.lease.id;
  }
  lease(roleId: string, id: string) {
    const session = this.forRole(roleId);
    if (!session.info.manual || session.lease?.id !== id || session.lease.until <= Date.now())
      throw new Error('Manual control expired. Take control again.');
    return session;
  }
  renew(roleId: string, id: string) {
    this.lease(roleId, id).lease!.until = Date.now() + 45_000;
  }
  release(roleId: string, id: string) {
    const session = this.lease(roleId, id);
    session.info.manual = false;
    session.lease = undefined;
    session.configure = true;
    this.touch(session);
  }
  allowSite(roleId: string, taskId: string, origin: string, allowed = true) {
    const session = this.forRole(roleId);
    if (new URL(origin).protocol !== 'https:' || new URL(origin).origin !== origin)
      throw new Error('Autonomous preparation requires an exact HTTPS origin.');
    if (!session.info.runId || session.info.taskId !== taskId || session.info.mode !== 'autonomous')
      throw new Error('This autonomous browser task has ended or changed.');
    if (!allowed)
      session.info.allowedSites = session.info.allowedSites.filter((site) => site !== origin);
    else if (!session.info.allowedSites.includes(origin)) session.info.allowedSites.push(origin);
    session.configure = true;
  }
  stop(runId: string) {
    const session = this.forRun(runId);
    this.runs.delete(runId);
    if (!session || session.info.runId !== runId) return;
    session.info.runId = null;
    this.touch(session);
  }
  async closeRole(roleId: string, reset = false) {
    const session = this.agents.get(roleId);
    if (session) {
      session.closing = true;
      clearTimeout(session.timer);
      try {
        if (session.driver) await (await session.driver).close();
      } finally {
        session.driver = undefined;
        session.info.status = 'closed';
        session.info.manual = false;
        session.lease = undefined;
        session.closing = false;
      }
    }
    if (reset) {
      const profile = await this.profile(roleId);
      await rm(profile, { recursive: true, force: true });
      this.agents.delete(roleId);
    }
  }
  async close() {
    await Promise.all([...this.agents.keys()].map((id) => this.closeRole(id)));
  }
  private touch(session: Session) {
    clearTimeout(session.timer);
    if (!session.info.runId) {
      session.timer = setTimeout(() => {
        void this.closeRole(session.info.roleId).catch(() => {});
      }, this.idleMs);
      session.timer.unref();
    }
  }
  private async profile(roleId: string) {
    roleIdSchema.parse(roleId);
    const root = join(this.directory, 'browser-profiles');
    const path = join(root, roleId);
    for (const folder of [root, path]) {
      await mkdir(folder, { recursive: true, mode: 0o700 });
      if (!(await lstat(folder)).isDirectory() || (await lstat(folder)).isSymbolicLink())
        throw new Error('Browser profiles cannot use symbolic links.');
    }
    return path;
  }
}
