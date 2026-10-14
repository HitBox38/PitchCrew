import type { Skill, SkillUpdatePreview } from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { CrewContext } from './types.ts';

/** User-only reviews bind an exact upstream snapshot and the saved skill it replaces. */
export class SkillUpdates {
  private readonly reviews = new Map<string, SkillUpdatePreview>();

  private current(context: CrewContext, id: string) {
    if (context.closing) throw new Error('The workspace is closing.');
    const skill = context.board.get<Skill>('skill', z.uuid().parse(id));
    if (skill.deletedAt) throw new Error('This skill has been deleted.');
    if (!skill.source) throw new Error('This skill has no registry source to update.');
    return skill;
  }

  async preview(context: CrewContext, id: string): Promise<SkillUpdatePreview> {
    const current = this.current(context, id);
    const latest = await context.previewSkill(current.source!.url);
    if (JSON.stringify(this.current(context, id)) !== JSON.stringify(current))
      throw new Error('This skill changed while checking. Check for updates again.');
    const review: SkillUpdatePreview = {
      id: randomUUID(),
      current: structuredClone(current),
      latest: structuredClone(latest),
      changed:
        current.name !== latest.name ||
        current.description !== latest.description ||
        current.content !== latest.content ||
        current.source!.blobSha !== latest.source?.blobSha ||
        current.source!.path !== latest.source?.path ||
        current.source!.repository !== latest.source?.repository,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
    for (const [key, value] of this.reviews)
      if (Date.parse(value.expiresAt) <= Date.now()) this.reviews.delete(key);
    if (this.reviews.size >= 100) this.reviews.delete(this.reviews.keys().next().value!);
    if (review.changed) this.reviews.set(review.id, review);
    return structuredClone(review);
  }

  approve(context: CrewContext, id: string, previewId: string): Skill {
    const current = this.current(context, id);
    const review = this.reviews.get(previewId);
    if (!review || review.current.id !== id || Date.parse(review.expiresAt) <= Date.now())
      throw new Error('This update preview expired. Check for updates again.');
    if (JSON.stringify(current) !== JSON.stringify(review.current))
      throw new Error('This skill changed after the preview. Check for updates again.');
    const updated = context.saveSkill(
      {
        ...review.latest,
        scope: current.scope,
        roleIds: current.roleIds,
        ...(current.bundledId ? { bundledId: current.bundledId } : {}),
      },
      id,
    );
    this.reviews.delete(previewId);
    return updated;
  }
}
