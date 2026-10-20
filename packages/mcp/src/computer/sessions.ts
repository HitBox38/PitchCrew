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
  private readonly profiles = new Map<string, Promise<BrowserDriver>>();
  key = (roleId: string, threadId?: string | null, cardId?: string | null) => {
    return cardId
      ? `${roleId}:job:${cardId}`
      : threadId
        ? `${roleId}:conversation:${threadId}`
        : roleId;
  };
  keyForRun = (runId: string) => {
    return this.runs.get(runId) ?? runId;
  };
  constructor(
    private readonly directory: string,
    private readonly launch: (profile?: string) => Promise<BrowserDriver>,
    private readonly idleMs = 10 * 60_000,
  ) {}
  bind = (input: Binding) => {
    const key = this.key(input.roleId, input.threadId, input.cardId);
    let session = this.agents.get(key);
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
      this.agents.set(key, session);
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
    this.runs.set(input.runId, key);
  };
  forRun = (id: string) => {
    const direct = this.agents.get(this.runs.get(id) ?? id);
    if (direct) return direct;
    const matches = [...this.agents.values()].filter((s) => s.info.roleId === id);
    if (matches.length > 1) throw new Error('Choose the browser for this job or conversation.');
    return matches[0];
  };
  forRole = (id: string) => {
    const session = this.forRun(id);
    if (!session || session.closing) throw new Error('This agent has no open browser.');
    return session;
  };
  list = () => {
    return [...this.agents.values()].map((session) => ({
      ...session.info,
      allowedSites: [...session.info.allowedSites],
    }));
  };
  assertAgent = (id: string) => {
    const session = this.forRun(id);
    if (session?.info.manual)
      throw new Error('Manual control is active. Wait for the user to return browser control.');
    if (session?.closing) throw new Error('Browser is closing.');
  };
  driver = async (id: string) => {
    let session = this.forRun(id);
    if (!session) {
      this.bind({ runId: id, roleId: id, cardId: null });
      session = this.forRun(id)!;
    }
    if (session.closing) throw new Error('Browser is closing.');
    if (!session.driver) {
      const current = session;
      const roleId = current.info.roleId;
      const primary = this.profiles.get(roleId);
      current.driver = primary
        ? primary.then((driver) =>
            driver.newTab
              ? driver.newTab()
              : this.profile(roleId).then((path) => this.launch(path)),
          )
        : this.profile(roleId).then((path) => this.launch(path));
      if (!primary) this.profiles.set(roleId, current.driver);
      current.driver = current.driver
        .then((driver) => {
          current.info.status = 'open';
          return driver;
        })
        .catch((error) => {
          current.driver = undefined;
          if (!primary) this.profiles.delete(roleId);
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
  };
  frame = async (roleId: string): Promise<BrowserFrame | null> => {
    const session = this.forRole(roleId);
    if (!session.driver) return null;
    const driver = await this.driver(roleId);
    const frame = driver.frame
      ? await driver.frame()
      : { ...(await driver.snapshot()), width: 1280, height: 800 };
    Object.assign(session.info, { url: frame.url, title: frame.title });
    return frame;
  };
  openRole = async (roleId: RoleId, threadId: string, cardId: string | null) => {
    const key = this.key(roleId, threadId, cardId);
    if (!this.agents.has(key)) {
      this.bind({ runId: `user:${key}`, roleId, threadId, cardId });
      this.stop(`user:${key}`);
    }
    await this.driver(key);
  };
  take = (roleId: string) => {
    const session = this.forRole(roleId);
    if (session.info.status !== 'open' || !session.driver)
      throw new Error('Open the browser before taking control.');
    if (session.lease && session.lease.until > Date.now())
      throw new Error('Browser is controlled in another view. Return control there first.');
    session.info.manual = true;
    session.lease = { id: randomUUID(), until: Date.now() + 45_000 };
    this.touch(session);
    return session.lease.id;
  };
  lease = (roleId: string, id: string) => {
    const session = this.forRole(roleId);
    if (!session.info.manual || session.lease?.id !== id || session.lease.until <= Date.now())
      throw new Error('Manual control expired. Take control again.');
    return session;
  };
  renew = (roleId: string, id: string) => {
    this.lease(roleId, id).lease!.until = Date.now() + 45_000;
  };
  release = (roleId: string, id: string) => {
    const session = this.lease(roleId, id);
    session.info.manual = false;
    session.lease = undefined;
    session.configure = true;
    this.touch(session);
  };
  allowSite = (roleId: string, taskId: string, origin: string, allowed = true) => {
    const session = this.forRole(roleId);
    if (new URL(origin).protocol !== 'https:' || new URL(origin).origin !== origin)
      throw new Error('Autonomous preparation requires an exact HTTPS origin.');
    if (!session.info.runId || session.info.taskId !== taskId || session.info.mode !== 'autonomous')
      throw new Error('This autonomous browser task has ended or changed.');
    if (!allowed)
      session.info.allowedSites = session.info.allowedSites.filter((site) => site !== origin);
    else if (!session.info.allowedSites.includes(origin)) session.info.allowedSites.push(origin);
    session.configure = true;
  };
  stop = (runId: string) => {
    const session = this.forRun(runId);

    if (!session || session.info.runId !== runId) return;
    session.info.runId = null;
    this.touch(session);
  };
  closeRole = async (roleId: string, reset = false) => {
    if (!this.agents.has(roleId)) {
      const siblings = [...this.agents].filter(([, s]) => s.info.roleId === roleId);
      if (siblings.length > 1) {
        if (reset && siblings.some(([, s]) => s.info.runId || s.info.manual))
          throw new Error('Finish this agent’s other browser work before resetting shared logins.');
        for (const [key] of siblings) await this.closeRole(key, false);
        if (reset) {
          await rm(await this.profile(roleId), { recursive: true, force: true });
          for (const [key] of siblings) this.agents.delete(key);
        }
        return;
      }
    }

    const session = this.forRun(roleId);
    const actualRole = session?.info.roleId ?? roleId;
    if (
      reset &&
      [...this.agents.values()].some(
        (s) => s !== session && s.info.roleId === actualRole && (s.info.runId || s.info.manual),
      )
    )
      throw new Error('Finish this agent’s other browser work before resetting shared logins.');
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
        if (![...this.agents.values()].some((s) => s.info.roleId === actualRole && s.driver))
          this.profiles.delete(actualRole);
      }
    }
    if (reset) {
      for (const [key, other] of this.agents)
        if (other !== session && other.info.roleId === actualRole) await this.closeRole(key);
      const profile = await this.profile(actualRole);
      await rm(profile, { recursive: true, force: true });
      for (const [key, other] of this.agents)
        if (other.info.roleId === actualRole) this.agents.delete(key);
      this.profiles.delete(actualRole);
    }
  };
  close = async () => {
    await Promise.all([...this.agents.keys()].map((id) => this.closeRole(id)));
  };
  private touch = (session: Session) => {
    clearTimeout(session.timer);
    if (!session.info.runId) {
      session.timer = setTimeout(() => {
        void this.closeRole(
          this.key(session.info.roleId, session.info.threadId, session.info.cardId),
        ).catch(() => {});
      }, this.idleMs);
      session.timer.unref();
    }
  };
  private profile = async (roleId: string) => {
    roleIdSchema.parse(roleId);
    const root = join(this.directory, 'browser-profiles');
    const path = join(root, roleId);
    for (const folder of [root, path]) {
      await mkdir(folder, { recursive: true, mode: 0o700 });
      if (!(await lstat(folder)).isDirectory() || (await lstat(folder)).isSymbolicLink())
        throw new Error('Browser profiles cannot use symbolic links.');
    }
    return path;
  };
}
