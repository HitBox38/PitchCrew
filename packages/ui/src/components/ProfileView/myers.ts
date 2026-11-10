type Line = { kind: 'same' | 'removed' | 'added'; text: string };

/** Working memory for the edit trace, in numbers kept (about 16 MB). */
const budget = 4_000_000;

/**
 * Myers' O(ND) line diff: the shortest edit script, fast when the notes differ little however
 * long they are. Returns null when the edit is too large for the memory budget.
 */
export const myersDiff = (before: string[], after: string[]): Line[] | null => {
  const n = before.length;
  const m = after.length;
  const max = n + m;
  const offset = max + 1;
  const limit = Math.min(max, Math.floor(budget / (2 * max + 3)));
  const v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];
  for (let d = 0; d <= limit; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      const down = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]);
      let x = down ? v[offset + k + 1] : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && before[x] === after[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) return backtrack(trace, before, after, offset);
    }
  }
  return null;
};

const backtrack = (trace: Int32Array[], before: string[], after: string[], offset: number) => {
  const lines: Line[] = [];
  let x = before.length;
  let y = after.length;
  for (let d = trace.length - 1; d > 0; d--) {
    const v = trace[d];
    const k = x - y;
    const down = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]);
    const previous = down ? k + 1 : k - 1;
    const px = v[offset + previous];
    const py = px - previous;
    while (x > px && y > py) {
      x--;
      y--;
      lines.push({ kind: 'same', text: before[x] });
    }
    if (down) lines.push({ kind: 'added', text: after[--y] });
    else lines.push({ kind: 'removed', text: before[--x] });
  }
  while (x > 0 && y > 0) {
    x--;
    y--;
    lines.push({ kind: 'same', text: before[x] });
  }
  return lines.reverse();
};
