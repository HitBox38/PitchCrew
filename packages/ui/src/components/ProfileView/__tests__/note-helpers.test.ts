import { describe, expect, it } from 'vitest';
import {
  filenameFor,
  noteLabel,
  filenameProblem,
  noteCitations,
  citationRows,
  proposalNotice,
  saveBlocker,
  wordCount,
} from '../helpers.ts';
import { documentDirty, openDocument, renameDocument } from '../documents.ts';

const background = { name: 'background.md', content: '# Background' };
const projects = { name: 'projects.md', content: '# Projects' };

describe('profile note helpers', () => {
  it('follows a completed rename without losing the draft or the saved copy', () => {
    const state = openDocument({ documents: [], activeId: null }, background, 'background');
    state.documents[0] = { ...state.documents[0], content: '# Unsaved draft' };
    const renamed = renameDocument(state, 'background.md', 'about-me.md');
    expect(renamed.documents[0]).toMatchObject({
      name: 'about-me.md',
      content: '# Unsaved draft',
      saved: { name: 'about-me.md', content: '# Background' },
    });
    expect(documentDirty(renamed.documents[0])).toBe(true);
    expect(renameDocument(renamed, 'projects.md', 'work.md')).toEqual(renamed);
  });

  it('names a new note after its title without reusing a filename', () => {
    expect(filenameFor('Work history', [])).toBe('Work-history.md');
    expect(filenameFor('Café & Résumé!', [])).toBe('Cafe-Resume.md');
    expect(filenameFor('Work history', ['work-history.md', 'Work-History-2.md'])).toBe(
      'Work-history-3.md',
    );
    expect(filenameFor('notes.md', [])).toBe('notes.md');
    expect(filenameFor('שלום', [])).toBe('Untitled-note.md');
    expect(filenameFor('  ', [projects.name])).toBe('Untitled-note.md');
  });

  it('reads filenames as note names', () => {
    expect(noteLabel('Work-history.md')).toBe('Work history');
    expect(noteLabel('side_projects.md')).toBe('side projects');
    expect(noteLabel('profile.md')).toBe('profile');
    expect(noteLabel('---.md')).toBe('---.md');
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
    // Markdown marks and link targets are not words; hyphenated words count once.
    expect(wordCount('# Title\n\n- one two')).toBe(3);
    expect(wordCount('A real-time [demo](https://example.com/a b) ---')).toBe(3);
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
