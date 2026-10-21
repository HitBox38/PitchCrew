/** Content identities for read-only lists, including repeated identical entries.
 * Duplicate occurrences have no independent state; their keys cannot collide.
 * Editable rows must keep their own IDs instead of using this helper.
 */
export const keyedItems = <T>(items: readonly T[], identity: (item: T) => string) => {
  const occurrences = new Map<string, number>();
  return items.map((item) => {
    const value = identity(item);
    const occurrence = occurrences.get(value) ?? 0;
    occurrences.set(value, occurrence + 1);
    return { item, key: JSON.stringify([value, occurrence]) };
  });
};
