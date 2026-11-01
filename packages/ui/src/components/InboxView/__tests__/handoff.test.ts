import type { Approval, Card, PacketArtifact, Snapshot } from '@pitchcrew/core';
import { describe, expect, it } from 'vitest';
import { acceptsFile, cardHandoff, neededFiles, packetHandoff } from '../handoff.ts';

const artifact = (name: PacketArtifact['name'], source: PacketArtifact['source']) =>
  ({
    name,
    source,
    mimeType: name.endsWith('.pdf')
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }) as PacketArtifact;
const field = (label: string, accept = '', required = true) => ({
  label,
  type: 'file',
  required,
  visible: true,
  disabled: false,
  accept,
  options: [],
  assessed: true,
  condition: '',
  missingAnswer: '',
});
const formCard = (fields: ReturnType<typeof field>[]) =>
  ({
    applicationContext: {
      form: { status: 'inspected', url: '', fields, blockers: [], uninspected: [] },
    },
  }) as unknown as Card;
const approval = (artifacts: PacketArtifact[]) =>
  ({ id: 'a', cardId: 'c', digest: 'd1', artifacts }) as Approval;

describe('packet handoff', () => {
  it('matches form uploads to the frozen files and flags what the packet cannot supply', () => {
    const files = neededFiles(
      formCard([
        field('Resume/CV', '.pdf'),
        field('Cover letter', '.docx'),
        field('Portfolio', '', false),
        field('Writing sample'),
      ]),
      approval([artifact('resume.pdf', 'resume'), artifact('cover_letter.pdf', 'coverLetter')]),
    );
    expect(files?.map((file) => [file.label, file.status, file.files])).toEqual([
      ['Resume/CV', 'covered', ['resume.pdf']],
      ['Cover letter', 'format', []],
      ['Portfolio', 'yours', []],
      ['Writing sample', 'yours', []],
    ]);
    expect(neededFiles(formCard([field('Resume')]), approval([]))?.[0]?.status).toBe('export');
    expect(neededFiles({} as Card, approval([]))).toBeNull();
  });

  it('reads accept lists by extension, exact type and wildcard', () => {
    const pdf = artifact('resume.pdf', 'resume');
    expect(acceptsFile('', pdf)).toBe(true);
    expect(acceptsFile('.PDF, .doc', pdf)).toBe(true);
    expect(acceptsFile('application/*', pdf)).toBe(true);
    expect(acceptsFile('image/png,.docx', pdf)).toBe(false);
  });

  it('shows summaries and change notes only for the exact approved packet', () => {
    const card = {
      id: 'c',
      packetReview: { packetDigest: 'd1', runId: 'r', summary: { assessment: 'Ready.' } },
      packetChanges: { packetDigest: 'old', notes: ['Earlier change.'] },
    } as unknown as Card;
    const data = {
      cards: [card],
      runs: [{ id: 'r', roleId: 'critic' }],
      roles: [{ id: 'critic', name: 'Critic' }],
    } as unknown as Snapshot;
    expect(packetHandoff(approval([]), data)).toMatchObject({
      reviewed: true,
      summary: { assessment: 'Ready.' },
      reviewer: { id: 'critic', name: 'Critic' },
      changes: [],
    });
    expect(packetHandoff({ ...approval([]), digest: 'd2' }, data).reviewed).toBe(false);
  });

  it("reads the job's current review, keeping change notes only for the reviewed packet", () => {
    const data = {
      runs: [{ id: 'run-1', roleId: 'critic' }],
      roles: [{ id: 'critic', name: 'Critic' }],
    } as unknown as Snapshot;
    const summary = { assessment: 'Ready', highlights: [], limitations: [], nextSteps: ['Apply'] };
    const reviewed = {
      packetReview: { packetDigest: 'd1', runId: 'run-1', summary },
      packetChanges: { packetDigest: 'd1', notes: ['Shortened the resume'] },
    } as unknown as Card;
    expect(cardHandoff(reviewed, data)).toEqual({
      reviewed: true,
      summary,
      reviewer: { id: 'critic', name: 'Critic' },
      changes: ['Shortened the resume'],
    });
    const stale = { ...reviewed, packetChanges: { packetDigest: 'd0', notes: ['Old'] } } as Card;
    expect(cardHandoff(stale, data).changes).toEqual([]);
    const draft = { packetChanges: { packetDigest: 'd2', notes: ['New draft'] } } as Card;
    expect(cardHandoff(draft, data)).toMatchObject({ reviewed: false, changes: ['New draft'] });
  });
});
