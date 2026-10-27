import type { DefaultInstructionRevision } from '@pitchcrew/core';

export interface RecordedRevision extends DefaultInstructionRevision {
  /** Existed only on a feature branch before release. Matched as an earlier default, but not listed as a change. */
  prerelease?: true;
}

/**
 * Every default instruction text each seeded role has shipped with, oldest first.
 * The last entry must be the current text in default-roles.ts.
 *
 * Revisions are the first 16 hex characters of the SHA-256 of the whitespace-normalized text
 * (see instructionRevision). Earlier texts were reconstructed by evaluating defaultRoles() at
 * every commit that touched it, plus the original seed in board roles before default-roles.ts.
 * Only hashes are stored here: a customized role's base comes from its reviewed source or event history.
 *
 * When you change a default role's instructions, append an entry here with the new revision
 * and a one-sentence summary. The board tests fail and print the expected revision until you do.
 */
export const defaultInstructionHistory: Record<string, RecordedRevision[]> = {
  scout: [
    {
      revision: '485b6df09a211b09',
      date: '2026-10-01',
      summary: 'First default: evaluate the job against the profile and never invent jobs.',
    },
    {
      revision: '5351034367241fe7',
      date: '2026-10-04',
      summary:
        'Expanded fit checks: required and preferred qualifications, gaps, a 0-100 score, untrusted external content and crew handoffs.',
    },
    {
      revision: '7639d68ae31e92a7',
      date: '2026-10-04',
      summary: 'Reads application insights before recommending a next step.',
      prerelease: true,
    },
    {
      revision: '040296e5bc252a0d',
      date: '2026-10-05',
      summary:
        'Adds job discovery: when you enable it, scan your saved job sources and give a short fit read for new leads.',
    },
    {
      revision: '99ee31027dc9d202',
      date: '2026-10-05',
      summary:
        "Adds application insights: read outcomes and your lessons for the job's tags when allowed.",
    },
    {
      revision: '4e92b80827a6000b',
      date: '2026-10-13',
      summary:
        'Adds single posting link imports as leads when discovery is enabled, with duplicates left unchanged.',
    },
    {
      revision: '636c1211e847fe94',
      date: '2026-10-19',
      summary:
        'Reads public posting pages and can attach a link and refresh an explicitly selected existing job.',
    },
    {
      revision: '435633186ea43219',
      date: '2026-10-27',
      summary:
        'Opens supplied posting links in the in-app browser and saves inspected job details before asking for pasted text.',
    },
  ],
  writer: [
    {
      revision: '41bea09acad730c1',
      date: '2026-10-01',
      summary: 'First default: a tailored packet with verbatim profile quotes.',
    },
    {
      revision: 'dc9c3471fb3730ec',
      date: '2026-10-04',
      summary:
        'Expanded drafting: exact claims, form assessments, review handoffs and fixed 650 and 500 word limits.',
    },
    {
      revision: 'c9ad9b84953e243f',
      date: '2026-10-04',
      summary: 'Reads application insights before drafting.',
      prerelease: true,
    },
    {
      revision: '32b6eff9a057d9ab',
      date: '2026-10-04',
      summary: 'Clearer wording for the application insights step.',
      prerelease: true,
    },
    {
      revision: '0ad8f0d05216e068',
      date: '2026-10-05',
      summary:
        'Follows your packet rules instead of fixed word limits and checks drafts with pitchcrew_lint_packet.',
    },
    {
      revision: '5a080167cb370761',
      date: '2026-10-05',
      summary:
        'Adds application insights: apply your lessons on framing, emphasis and tone when allowed.',
    },
    {
      revision: '1aac02440890f5af',
      date: '2026-10-27',
      summary:
        'Uses confirmed form fields, upload formats and length limits before drafting, and records uninspected limitations.',
    },
  ],
  reviewer: [
    {
      revision: '3e5e7fab61da6ea4',
      date: '2026-10-01',
      summary: 'First default: check every statement against the profile.',
    },
    {
      revision: '4222a0041346461b',
      date: '2026-10-04',
      summary:
        'Expanded review: the whole packet, exact quotations, form requirements, blockers versus style, and fixed 650 and 500 word limits.',
    },
    {
      revision: '0dc6c20b81317766',
      date: '2026-10-05',
      summary:
        'Enforces your packet rules instead of fixed word limits. Rule warnings are advice, not blockers.',
    },
    {
      revision: '0b63799645984b9e',
      date: '2026-10-27',
      summary:
        'Reviews the whole packet against the confirmed application form requirement summary.',
    },
  ],
  submitter: [
    {
      revision: '9dd6837b3291ebae',
      date: '2026-10-04',
      summary: 'First default: inspect forms and submit only with exact approvals.',
    },
    {
      revision: '0edf890781c8ba2d',
      date: '2026-10-12',
      summary:
        'Uses chat browser supervision, user-granted autonomous preparation and private manual takeover; submission still requires exact approval.',
    },
    {
      revision: '02a53bb26e867e30',
      date: '2026-10-27',
      summary:
        'Inspects forms before drafting without requiring exported files, then rechecks requirements during submission preparation.',
    },
  ],
  tracker: [
    {
      revision: '9c803246488e494f',
      date: '2026-10-04',
      summary: 'First default: keep application status in line with verified email evidence.',
    },
  ],
  documenter: [
    {
      revision: '78339307a300dd1b',
      date: '2026-10-04',
      summary: 'First default: propose profile updates from sources you watch.',
    },
  ],
  'career-coach': [
    {
      revision: '4c8f29e80e1aa262',
      date: '2026-10-17',
      summary:
        'First default: interview coaching, career planning and grounded offer evaluation in chat.',
    },
  ],
  'pipeline-coach': [
    {
      revision: 'cda4f06a756c5694',
      date: '2026-10-04',
      summary: 'First default: batch reviews of the whole crew with measurable follow-ups.',
    },
    {
      revision: '373c4a4a52c18a54',
      date: '2026-10-05',
      summary:
        'Starts each review with application insights: outcomes, tags, weights and your lessons.',
    },
  ],
};
