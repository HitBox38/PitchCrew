import { expect, it } from 'vitest';
import type { Snapshot, SkillUpdateCheck } from '@pitchcrew/core';
import {
  isPendingSkillUpdate,
  skillSourceRevision,
  skillUpdateCheckInterval,
} from '@pitchcrew/core/skill-updates';
import { availableSkillUpdates, pendingSkillUpdates } from '../../lib/skill-updates.ts';
import { notificationShouldAlert, collectNotifications } from '../../Notifications/helpers.ts';
import { nextSkillCheckDelay } from '../helpers.ts';

const source = {
  url: 'https://skills.sh/fictional/skills/example',
  repository: 'fictional/skills',
  path: 'example/SKILL.md',
  blobSha: 'a'.repeat(40),
  fetchedAt: '2026-10-17T00:00:00.000Z',
};
const check: SkillUpdateCheck = {
  skillId: 'fictional-skill',
  installed: source,
  latest: { ...source, blobSha: 'b'.repeat(40) },
  checkedAt: source.fetchedAt,
};
const data = {
  skills: [{ id: check.skillId, name: 'Example', source, deletedAt: null }],
  skillUpdates: { automatic: true, checking: false, checks: [check] },
  roles: [],
  cards: [],
  messages: [],
  approvals: [],
  computerApprovals: [],
  proposals: [],
  skillProposals: [],
} as unknown as Snapshot;

it('keeps badge counts independent of reading notices and changes them only for a version decision', () => {
  const notices = collectNotifications(data);
  expect(notices).toHaveLength(1);
  expect(notices[0]).toMatchObject({
    context: 'skill_update',
    reviewId: check.skillId,
    target: '/skills',
  });
  expect(notificationShouldAlert(notices[0]!)).toBe(false);
  expect(notificationShouldAlert({ ...notices[0]!, context: 'instruction_update' })).toBe(false);
  expect(notificationShouldAlert({ ...notices[0]!, context: 'input' })).toBe(true);
  expect(pendingSkillUpdates(data)).toHaveLength(1);
  const dismissed = { ...check, dismissedRevision: skillSourceRevision(check.latest!) };
  const decided = { ...data, skillUpdates: { ...data.skillUpdates!, checks: [dismissed] } };
  expect(pendingSkillUpdates(decided)).toEqual([]);
  expect(collectNotifications(decided)).toEqual([]);
  expect(availableSkillUpdates(decided)).toHaveLength(1);
  expect(
    isPendingSkillUpdate({ ...dismissed, latest: { ...source, blobSha: 'c'.repeat(40) } }),
  ).toBe(true);
  expect(pendingSkillUpdates({ ...data, skills: [] })).toEqual([]);
});

it('does not postpone the daily check when the workspace reopens shortly before it is due', () => {
  expect(
    nextSkillCheckDelay(data, Date.parse(check.checkedAt) + skillUpdateCheckInterval - 120_000),
  ).toBe(120_000);
  expect(nextSkillCheckDelay(data, Date.parse(check.checkedAt))).toBe(skillUpdateCheckInterval);
  expect(nextSkillCheckDelay({ ...data, skills: [] })).toBe(skillUpdateCheckInterval);
  expect(
    nextSkillCheckDelay({ ...data, skillUpdates: { ...data.skillUpdates!, checks: [] } }),
  ).toBe(60_000);
});
