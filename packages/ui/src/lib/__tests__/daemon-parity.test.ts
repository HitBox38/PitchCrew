import { expect, it } from 'vitest';
import { importLimits } from '../../../../core/src/imports.ts';
import { packetRuleLimits } from '../../../../core/src/packet-rules.ts';
import { noteNameSchema } from '../../../../orchestrator/src/profile-notes/helpers.ts';
import {
  nextOccurrence,
  parseRoutine,
} from '../../../../orchestrator/src/crew/routines/schedule.ts';
import { maxImportBytes, maxImportRows } from '@/ImportApplications/constants.ts';
import { rulesFileBytes } from '@/PacketRules/constants.ts';
import { filenameProblem } from '@/components/ProfileView/helpers.ts';
import { draftInput, initialDraft } from '@/RoutinesPage/helpers.ts';
import { nextRunPreview } from '@/RoutinesPage/schedule-preview.ts';

// Each UI copy of a daemon rule is paired with its original here, so drift fails CI.

it('shares the daemon limits the UI repeats', () => {
  expect(maxImportBytes).toBe(importLimits.bytes);
  expect(maxImportRows).toBe(importLimits.rows);
  expect(rulesFileBytes).toBe(packetRuleLimits.fileBytes);
});

it.each([
  'Work-history.md',
  'a.md',
  'notes.txt',
  '.md',
  'a..b.md',
  'has space.md',
  'ünï.md',
  `${'a'.repeat(97)}.md`,
  `${'a'.repeat(98)}.md`,
])('accepts the same note filenames as the daemon: %s', (name) => {
  expect(filenameProblem(name, []) === '').toBe(noteNameSchema.safeParse(name).success);
});

const draft = {
  ...initialDraft(null),
  name: 'Fictional routine',
  content: 'Fictional action',
  timezone: 'Asia/Jerusalem',
  startLocal: '2030-01-05T09:00',
  endLocal: '',
};
const drafts = [
  { ...draft, frequency: 'once' as const },
  { ...draft, frequency: 'interval' as const, interval: '2', unit: 'hours' as const },
  { ...draft, frequency: 'daily' as const },
  { ...draft, frequency: 'weekdays' as const },
  { ...draft, frequency: 'weekly' as const },
  { ...draft, frequency: 'monthly' as const, startLocal: '2030-01-31T09:00' },
  { ...draft, frequency: 'weekdays' as const, endLocal: '2030-01-06T09:00' },
];

it.each(drafts)('previews the run the daemon schedules for $frequency', (item) => {
  expect(nextRunPreview(item)).toBe(nextOccurrence(parseRoutine(draftInput(item))));
});
