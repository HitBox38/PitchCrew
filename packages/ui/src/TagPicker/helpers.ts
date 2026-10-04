export function uniqueTags(tags: string[]): string[] {
  const seen = new Set<string>();
  return tags
    .map((tag) => tag.trim())
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function tagValues(tags: string[]): string[] {
  const values = uniqueTags(tags);
  if (values.length > 10) throw new Error('Choose up to 10 tags. Remove a tag to add another.');
  if (values.some((tag) => tag.length > 40))
    throw new Error('Keep each tag to 40 characters or fewer.');
  return values;
}

export function tagOptions(suggestions: string[], selected: string[], query: string) {
  const known = uniqueTags([...suggestions, ...selected]);
  const trimmed = query.trim();
  return {
    items: uniqueTags([...known, trimmed]),
    custom:
      trimmed && !known.some((tag) => tag.toLowerCase() === trimmed.toLowerCase()) ? trimmed : null,
  };
}
