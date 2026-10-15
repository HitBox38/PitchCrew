/** Clamp after removals and keep the rendered range bounded, including empty lists. */
export function pageRange(count: number, requested: number, size: number) {
  const pages = Math.max(1, Math.ceil(count / size));
  const page = Math.max(0, Math.min(requested, pages - 1));
  const start = page * size;
  return { page, pages, start, end: Math.min(count, start + size) };
}
