import { markdownLanguage } from '@codemirror/lang-markdown';

const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** A numeric reference as HTML reads it: zero, surrogates and out-of-range values become �. */
const codePoint = (code: string) => {
  const value = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
  const valid =
    Number.isInteger(value) && value > 0 && value <= 0x10ffff && (value < 0xd800 || value > 0xdfff);
  return valid ? String.fromCodePoint(value) : '\uFFFD';
};

/**
 * A task as the reader sees it, the same whether read from the source or from the rendered
 * preview: images as the preview shows them ("Image: alt"), link targets, tags, Markdown marks
 * and brackets removed, entities decoded, spaces folded.
 */
export const readableTask = (text: string) =>
  text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, (_, alt: string) => `Image: ${alt || 'image'}`)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<((?:https?|mailto):[^>\s]+|[^@>\s]+@[^>\s]+)>/gi, '$1')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, name: string) => entities[name])
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code: string) => codePoint(code))
    // The preview shows a blocked image as "[Image blocked: alt]".
    .replace(/Image blocked:/gi, 'Image:')
    .replace(/[*_`~\\[\]<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();

type Marker = { from: number; text: string };
let cached: { content: string; markers: Marker[] } | null = null;

/**
 * Every task box ("[ ]" / "[x]") in a note, in document order, with its task's readable text,
 * read from the same GFM parse the editor uses, so quoted and ordered tasks count and code that
 * only looks like a task does not.
 */
export const taskMarkers = (content: string): Marker[] => {
  if (cached?.content === content) return cached.markers;
  const markers: Marker[] = [];
  markdownLanguage.parser.parse(content).iterate({
    enter: (node) => {
      if (node.name !== 'TaskMarker') return;
      const task = node.node.parent;
      markers.push({ from: node.from, text: readableTask(content.slice(node.to, task?.to)) });
    },
  });
  cached = { content, markers };
  return markers;
};

/**
 * Where each rendered task box's source task starts. The preview's renderer and the editor's
 * parser can disagree on odd Markdown; a box maps to a task only when both list the same tasks
 * in the same order, text for text. Otherwise every box is read-only (undefined): a box must
 * never change another task.
 */
export const mapTasks = (content: string, rendered: string[]): (number | undefined)[] => {
  const markers = taskMarkers(content);
  const agree =
    rendered.length === markers.length &&
    rendered.every((text, index) => readableTask(text) === markers[index].text);
  return agree ? markers.map((marker) => marker.from) : rendered.map(() => undefined);
};

/** Checks or unchecks the task box whose marker starts at `at`. */
export const toggleTaskAt = (content: string, at: number) => {
  if (content[at] !== '[') return content;
  const mark = content[at + 1] === ' ' ? 'x' : ' ';
  return `${content.slice(0, at + 1)}${mark}${content.slice(at + 2)}`;
};

/** Checks or unchecks the nth of the rendered boxes (see `mapTasks`); unchanged if unsafe. */
export const toggleTaskNumber = (content: string, index: number, rendered?: string[]) => {
  const at = rendered ? mapTasks(content, rendered)[index] : taskMarkers(content)[index]?.from;
  return at === undefined ? content : toggleTaskAt(content, at);
};
