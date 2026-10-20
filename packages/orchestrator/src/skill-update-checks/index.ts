import {
  hasSkillUpdate,
  skillSourceRevision,
  skillUpdateCheckInterval,
  type Skill,
  type SkillPreview,
  type SkillUpdatesState,
} from '@pitchcrew/core';
import type { CrewContext } from '../crew/types.ts';
import { skillDirectory } from '../skills-directory.ts';
import { SkillUpdateStore } from './store.ts';

export class SkillUpdateChecks {
  private readonly store: SkillUpdateStore;
  private request?: Promise<SkillUpdatesState>;

  constructor(directory: string) {
    this.store = new SkillUpdateStore(directory);
  }
  /** Snapshot validators inspect maintenance state without reading skill projections. */
  revision = () => {
    return { ...this.store.get(), checking: Boolean(this.request) };
  };

  current = (context: CrewContext): SkillUpdatesState => {
    const state = this.store.get();
    const skills = new Map(
      context
        .skills()
        .filter((skill) => skill.source)
        .map((skill) => [skill.id, skill.source!]),
    );
    return {
      automatic: state.automatic,
      checking: Boolean(this.request),
      checks: state.checks.filter((check) => {
        const source = skills.get(check.skillId);
        return (
          source &&
          source.url === check.installed.url &&
          skillSourceRevision(source) === skillSourceRevision(check.installed)
        );
      }),
    };
  };

  setAutomatic = (automatic: boolean) => {
    this.store.automatic(automatic);
  };

  /** Also record manual per-skill reviews, so all entry points share the same notice. */
  observe = (context: CrewContext, skill: Skill, latest: SkillPreview) => {
    if (!skill.source || !latest.source || context.closing) return;
    const previous = this.previous(skill);
    const now = new Date().toISOString();
    this.store.put({
      skillId: skill.id,
      installed: skill.source,
      latest: latest.source,
      checkedAt: now,
      successfulAt: now,
      detectedAt:
        previous?.latest &&
        skillSourceRevision(previous.latest) === skillSourceRevision(latest.source)
          ? (previous.detectedAt ?? now)
          : now,
      ...(previous?.dismissedRevision ? { dismissedRevision: previous.dismissedRevision } : {}),
    });
  };

  dismiss = (context: CrewContext, id: string, revision: string) => {
    const check = this.current(context).checks.find((item) => item.skillId === id);
    if (!check || !hasSkillUpdate(check) || skillSourceRevision(check.latest!) !== revision)
      throw new Error('The skill update changed. Review the latest version first.');
    this.store.put({ ...check, dismissedRevision: revision });
    return this.current(context);
  };

  check = (context: CrewContext, automatic: boolean): Promise<SkillUpdatesState> => {
    if (context.closing) return Promise.reject(new Error('The workspace is closing.'));
    if (automatic && !this.store.get().automatic) return Promise.resolve(this.current(context));
    if (this.request) return this.request.then(() => this.current(context));
    this.request = this.run(context, automatic).finally(() => {
      this.request = undefined;
    });
    return this.request.then(() => this.current(context));
  };

  close = async () => {
    await this.request;
  };

  private run = async (context: CrewContext, automatic: boolean): Promise<SkillUpdatesState> => {
    const checks = new Map(this.current(context).checks.map((check) => [check.skillId, check]));
    const skills = context
      .skills()
      .filter(
        (skill) =>
          skill.source &&
          (!automatic ||
            !checks.has(skill.id) ||
            Date.now() - Date.parse(checks.get(skill.id)!.checkedAt) >= skillUpdateCheckInterval),
      );
    const signal = AbortSignal.any([context.modelController.signal, AbortSignal.timeout(180_000)]);
    const batch = skillDirectory.batch();
    for (const skill of skills) {
      if (context.closing || (automatic && !this.store.get().automatic)) break;
      const checkedAt = new Date().toISOString();
      try {
        signal.throwIfAborted();
        const latest = await skillDirectory.preview(skill.source!.url, signal, batch);
        if (this.unchanged(context, skill)) this.observe(context, skill, latest);
      } catch {
        if (context.closing) break;
        if (this.unchanged(context, skill))
          this.store.put({
            ...this.previous(skill),
            skillId: skill.id,
            installed: skill.source!,
            checkedAt,
            error: 'Couldn’t check. Check your connection or try again later.',
          });
      }
    }
    return this.current(context);
  };

  private unchanged = (context: CrewContext, skill: Skill) => {
    return (
      !context.closing &&
      JSON.stringify(context.board.get<Skill>('skill', skill.id)) === JSON.stringify(skill)
    );
  };

  private previous = (skill: Skill) => {
    const check = this.store.get().checks.find((item) => item.skillId === skill.id);
    return check &&
      skill.source &&
      skill.source.url === check.installed.url &&
      skillSourceRevision(skill.source) === skillSourceRevision(check.installed)
      ? check
      : undefined;
  };
}
