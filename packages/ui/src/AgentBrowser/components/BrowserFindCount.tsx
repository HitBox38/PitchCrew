/** "3 of 12", or "No matches" in rose; silent while the field is empty. */
export const BrowserFindCount = ({
  text,
  matches,
}: {
  text: string;
  matches: { active: number; total: number } | null;
}) => (
  <output
    className="browser-find-count"
    aria-live="polite"
    data-empty={text && matches && !matches.total ? '' : undefined}
  >
    {text && matches
      ? matches.total
        ? `${matches.active} of ${matches.total}`
        : 'No matches'
      : ''}
  </output>
);
