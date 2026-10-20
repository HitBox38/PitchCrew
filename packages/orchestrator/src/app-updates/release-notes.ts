/** A bounded text-only preview of GitHub's generated changelog, never release HTML. */
export function releaseNotes(body: string | null | undefined) {
  const section = body?.split(/^##\s+what(?:'s|’s)?\s+changed\s*$/im)[1]?.split(/^##\s/m)[0];
  const changes = (section?.split('\n') ?? [])
    .filter((line) => /^\s*[-*]\s+/.test(line))
    .map((line) =>
      line
        .replace(/^\s*[-*]\s+/, '')
        .replace(/\s+by @\S+ in https:\/\/github\.com\/\S+\s*$/, '')
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/<[^>]*>/g, '')
        .replace(/[*_`]/g, '')
        .replace(/\p{Cc}/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
  return {
    changes: changes
      .slice(0, 5)
      .map((change) => (change.length > 180 ? `${change.slice(0, 179)}…` : change)),
    moreChanges: changes.length > 5 || changes.some((change) => change.length > 180),
  };
}
