export { proseWordCount as wordCount } from '@/components/MarkdownEditor/helpers.ts';

/** Profile notes are written only while no agent run is active (the daemon enforces it). */
export const saveBlocker = (runs: { status: string }[], proposals: { status: string }[] = []) => {
  if (proposals.some((proposal) => proposal.status === 'applying'))
    return 'Finish the approved source update in Sources to save';
  const running = runs.filter((run) => run.status === 'running').length;
  if (!running) return '';
  return `Save available after ${running} ${running === 1 ? 'run finishes' : 'runs finish'}`;
};

interface CitedCard {
  id: string;
  company: string;
  title: string;
  state: string;
  packet: { claims: { source: string; quote: string }[] } | null;
}
/** Jobs whose current packet registers claims quoting this exact profile note. */
export const noteCitations = (cards: CitedCard[], name: string) =>
  cards.flatMap((card) => {
    const quotes = [
      ...new Set(
        (card.packet?.claims ?? [])
          .filter((claim) => claim.source === name)
          .map((claim) => claim.quote),
      ),
    ];
    return quotes.length
      ? [{ id: card.id, company: card.company, title: card.title, state: card.state, quotes }]
      : [];
  });

/** Compact rail rows: a packet quoting exactly the same lines as an earlier one names it instead. */
export const citationRows = <T extends { company: string; quotes: string[] }>(cited: T[]) =>
  cited.map((card, index) => {
    const key = card.quotes.join('\n');
    const earlier = cited.slice(0, index).find((other) => other.quotes.join('\n') === key);
    return { ...card, sameAs: earlier?.company ?? '' };
  });

/** One line naming a saved maintenance proposal, from its stored documents and source. */
export const proposalNotice = (proposal: {
  status: string;
  source: { label: string; input: { provider: string } };
  documents: { path: string }[];
  observation?: unknown;
}) => {
  const where = proposal.source.input.provider === 'github' ? 'GitHub' : 'Google Drive';
  const count = proposal.documents.length;
  const names = proposal.documents.map((file) => file.path.split('/').at(-1) ?? file.path);
  if (proposal.status === 'applying')
    return {
      tone: 'ochre',
      title: 'Approved update needs recovery',
      detail: proposal.source.label,
    };
  if (!count)
    return { tone: 'primary', title: `Project changed on ${where}`, detail: proposal.source.label };
  return {
    tone: 'primary',
    title: `${count} ${count === 1 ? 'note' : 'notes'} changed on ${where}`,
    detail: names.join(', '),
  };
};

/** Mirrors the daemon's simple Markdown filename rule and refuses to overwrite another note. */
export const filenameProblem = (name: string, taken: string[]) => {
  if (name.length > 100) return 'Use a filename of at most 100 characters.';
  if (!/^[\w.-]+\.md$/.test(name) || name.includes('..'))
    return 'Use letters, numbers, dots, dashes or underscores, ending in .md.';
  // Case-insensitive, as on macOS and Windows disks.
  if (taken.some((other) => other.toLowerCase() === name.toLowerCase()))
    return 'Another note already uses this filename.';
  return '';
};

/** Lowercase hex SHA-256 of a note's UTF-8 text, the baseline a save expects to replace. */
export const sha256 = async (text: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

/** A typed name as a filename stem: case kept, accents dropped, anything else a hyphen. */
export const slugName = (title: string) =>
  title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\.md$/i, '')
    .replace(/[^A-Za-z0-9_.]+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 60)
    .replace(/[-.]+$/, '');

/** A note title as an unused Markdown filename: "Work history" → "Work-history.md". */
export const filenameFor = (title: string, taken: string[]) => {
  const base = slugName(title) || 'Untitled-note';
  const used = new Set(taken.map((name) => name.toLowerCase()));
  let name = `${base}.md`;
  for (let index = 2; used.has(name.toLowerCase()); index++) name = `${base}-${index}.md`;
  return name;
};

/** How a note is named in the app: its filename read as words ("Work-history.md" → "Work history"). */
export const noteLabel = (name: string) =>
  name.replace(/\.md$/i, '').replace(/[-_]+/g, ' ').trim() || name;
