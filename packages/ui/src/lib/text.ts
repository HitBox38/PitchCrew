/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st, 22nd. */
export const ordinal = (n: number) => {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const tail = teen ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${tail}`;
};

/**
 * One line of at most `max` characters: whitespace collapses, and a longer text is cut at its last
 * word when that keeps more than 60% of the room (otherwise mid-word), then ends with "…".
 */
export const wordCut = (text: string, max: number) => {
  const line = text.replace(/\s+/g, ' ').trim();
  if (line.length <= max) return line;
  const excerpt = line.slice(0, Math.max(0, max - 1));
  const lastSpace = excerpt.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? excerpt.slice(0, lastSpace) : excerpt).trimEnd()}…`;
};

/** The first letter upper case: "next in line" → "Next in line". */
export const capitalize = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/**
 * An action without the subject its row already names: "Initech: Application work" beside
 * "Initech" reads "Application work". Unchanged unless the subject leads, followed by ":", "·", "–"
 * or "-" and a space.
 */
export const withoutSubject = (action: string, subject: string) => {
  if (!action.startsWith(subject)) return action;
  return /^\s*[:·–-]\s+(\S.*)$/.exec(action.slice(subject.length))?.[1] ?? action;
};
