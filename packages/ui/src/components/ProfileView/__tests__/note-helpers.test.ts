import { describe, expect, it } from 'vitest';
import {
  documentDirty,
  filenameProblem,
  noteCitations,
  citationRows,
  openDocument,
  proposalNotice,
  renameDocument,
  saveBlocker,
  wordCount,
} from '../helpers.ts';

const background = { name: 'background.md', content: '# Background' };
const projects = { name: 'projects.md', content: '# Projects' };

describe('profile note helpers', () => {
  it('drafts a filename on an open tab or opens the note first', () => {
    const state = openDocument({ documents: [], activeId: null }, background, 'background');
    const renamed = renameDocument(state, background, 'unused', 'about-me.md');
    expect(renamed.documents).toHaveLength(1);
    expect(renamed.documents[0]).toMatchObject({ name: 'about-me.md', saved: background });
    expect(documentDirty(renamed.documents[0])).toBe(true);
    const opened = renameDocument(renamed, projects, 'projects', 'work.md');
    expect(opened.activeId).toBe('projects');
    expect(opened.documents[1]).toMatchObject({ name: 'work.md', saved: projects });
    expect(opened.documents[0].name).toBe('about-me.md');
  });

  it('states the real reason saving is unavailable', () => {
    expect(saveBlocker([{ status: 'done' }])).toBe('');
    expect(saveBlocker([{ status: 'running' }])).toBe('Save available after 1 run finishes');
    expect(saveBlocker([{ status: 'running' }, { status: 'running' }])).toBe(
      'Save available after 2 runs finish',
    );
    expect(saveBlocker([], [{ status: 'applying' }])).toBe(
      'Finish the approved source update in Sources to save',
    );
  });

  it('counts words and lists only packets that quote this exact note', () => {
    expect(wordCount('  ')).toBe(0);
    expect(wordCount('# Title\n\n- one two')).toBe(5);
    const card = (id: string, sources: string[]) => ({
      id,
      company: `Company ${id}`,
      title: 'Engineer',
      state: 'in_review',
      packet: { claims: sources.map((source, index) => ({ source, quote: `q${index % 2}` })) },
    });
    const cited = noteCitations(
      [
        card('a', ['background.md', 'background.md', 'background.md']),
        card('b', ['projects.md']),
        { ...card('c', []), packet: null },
      ],
      'background.md',
    );
    expect(cited).toEqual([
      {
        id: 'a',
        company: 'Company a',
        title: 'Engineer',
        state: 'in_review',
        quotes: ['q0', 'q1'],
      },
    ]);
  });
});

describe('citation rows', () => {
  it('names the earlier packet when the quoted lines are identical', () => {
    const rows = citationRows([
      { company: 'Northstar', quotes: ['a', 'b'] },
      { company: 'Canvas', quotes: ['a', 'b'] },
      { company: 'Waypoint', quotes: ['a'] },
    ]);
    expect(rows.map((row) => row.sameAs)).toEqual(['', 'Northstar', '']);
  });
});

describe('profile notices', () => {
  const proposal = (status: string, paths: string[]) => ({
    status,
    source: { label: 'fictional/profile', input: { provider: 'github' } },
    documents: paths.map((path) => ({ path })),
  });
  it('names saved proposal changes without inventing details', () => {
    expect(proposalNotice(proposal('pending', ['Projects/atlas.md', 'motion.md']))).toEqual({
      tone: 'primary',
      title: '2 notes changed on GitHub',
      detail: 'atlas.md, motion.md',
    });
    expect(proposalNotice(proposal('pending', [])).title).toBe('Project changed on GitHub');
    expect(proposalNotice(proposal('applying', ['a.md'])).title).toBe(
      'Approved update needs recovery',
    );
  });
});

describe('note filenames', () => {
  it('accepts simple Markdown filenames that do not replace another note', () => {
    expect(filenameProblem('about-me.md', ['work.md'])).toBe('');
    expect(filenameProblem('work.md', ['work.md'])).toMatch(/already uses/);
    for (const name of ['notes.txt', 'a/b.md', '..md', 'a..b.md', ''])
      expect(filenameProblem(name, [])).toMatch(/ending in \.md/);
  });
});
