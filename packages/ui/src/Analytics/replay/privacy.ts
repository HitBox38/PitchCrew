export const wireframeGeometry = (node: Node | null): Record<string, string> => {
  if (!node || typeof Element === 'undefined' || !(node instanceof Element)) return {};
  const rect = node.getBoundingClientRect();
  const parent = node.parentElement?.getBoundingClientRect();
  const relative = rootTags.has(node.tagName.toLowerCase());
  const left = relative ? 0 : rect.left - (parent?.left ?? 0);
  const top = relative ? 0 : rect.top - (parent?.top ?? 0);
  const surface = node.getAttribute('data-replay-surface');
  return {
    style: `position:${relative ? 'relative' : 'absolute'};left:${number(left)}px;top:${number(top)}px;width:${Math.max(0, number(rect.width))}px;height:${Math.max(0, number(rect.height))}px;overflow:hidden;box-sizing:border-box;background:#f5f2ec;border:1px solid #c8c2b8;`,
    ...(replaySurfaces.includes(surface as (typeof replaySurfaces)[number])
      ? { 'data-replay-surface': surface! }
      : {}),
  };
};
const attributes = (input: unknown) => {
  const source = object(input);
  const result: Record<string, unknown> = {};
  if (typeof source.style === 'string' && stylePattern.test(source.style))
    result.style = source.style;
  if (replaySurfaces.includes(source['data-replay-surface'] as (typeof replaySurfaces)[number]))
    result['data-replay-surface'] = source['data-replay-surface'];
  return result;
};
const node = (input: unknown, geometry?: ReplayGeometry, depth = 0): ObjectValue => {
  const source = object(input);
  const common = {
    id: id(source.id),
    ...(typeof source.rootId === 'number' ? { rootId: id(source.rootId) } : {}),
  };
  if (depth > 100) return { ...common, type: 3, textContent: '[masked]' };
  if (source.type === 0)
    return { ...common, type: 0, childNodes: children(source.childNodes, geometry, depth) };
  if (source.type === 1) return { ...common, type: 1, name: 'html', publicId: '', systemId: '' };
  if (source.type === 2)
    return {
      ...common,
      type: 2,
      tagName: rootTags.has(source.tagName as string) ? source.tagName : 'div',
      attributes: attributes(geometry ? geometry(id(source.id)) : source.attributes),
      childNodes: children(source.childNodes, geometry, depth),
    };
  return { ...common, type: 3, textContent: source.type === 3 ? '[masked]' : '' };
};
const children = (input: unknown, geometry: ReplayGeometry | undefined, depth: number) => {
  return Array.isArray(input)
    ? input.slice(0, 20000).map((value) => node(value, geometry, depth + 1))
    : [];
};

/** Rebuild every supported rrweb event. Unknown, CSS, media, canvas, plugin and network events drop. */
export const sanitizeReplayEvent = (
  input: unknown,
  geometry?: ReplayGeometry,
): ObjectValue | null => {
  const source = object(input);
  if (typeof source.timestamp !== 'number' || !Number.isFinite(source.timestamp)) return null;
  const base = { type: source.type, timestamp: source.timestamp };
  const data = object(source.data);
  if (source.type === 0 || source.type === 1) return { ...base, data: {} };
  if (source.type === 4)
    return {
      ...base,
      data: {
        href: 'https://pitchcrew.invalid/',
        width: number(data.width),
        height: number(data.height),
      },
    };
  if (source.type === 2)
    return {
      ...base,
      data: {
        node: node(data.node, geometry),
        initialOffset: {
          top: number(object(data.initialOffset).top),
          left: number(object(data.initialOffset).left),
        },
      },
    };
  if (source.type !== 3) return null;
  const fields: ObjectValue = { source: data.source };
  if (data.source === 0) {
    fields.texts = Array.isArray(data.texts)
      ? data.texts.map((value) => ({ id: id(object(value).id), value: '[masked]' }))
      : [];
    fields.attributes = Array.isArray(data.attributes)
      ? data.attributes.map((value) => ({
          id: id(object(value).id),
          attributes: attributes(
            geometry ? geometry(id(object(value).id)) : object(value).attributes,
          ),
        }))
      : [];
    fields.removes = Array.isArray(data.removes)
      ? data.removes.map((value) => ({
          parentId: id(object(value).parentId),
          id: id(object(value).id),
        }))
      : [];
    fields.adds = Array.isArray(data.adds)
      ? data.adds.map((value) => ({
          parentId: id(object(value).parentId),
          nextId: id(object(value).nextId),
          node: node(object(value).node, geometry),
        }))
      : [];
  } else if (data.source === 1 || data.source === 6) {
    fields.positions = Array.isArray(data.positions)
      ? data.positions.map((value) => ({
          id: id(object(value).id),
          x: number(object(value).x),
          y: number(object(value).y),
          timeOffset: number(object(value).timeOffset),
        }))
      : [];
  } else if (data.source === 2)
    Object.assign(fields, {
      type: number(data.type),
      id: id(data.id),
      x: number(data.x),
      y: number(data.y),
    });
  else if (data.source === 3)
    Object.assign(fields, { id: id(data.id), x: number(data.x), y: number(data.y) });
  else if (data.source === 4)
    Object.assign(fields, { width: number(data.width), height: number(data.height) });
  else return null; // Inputs are blocked and never recorded, even masked.
  return { ...base, data: fields };
};

export const sanitizeReplayProperties = (
  input: Record<string, unknown>,
): Record<string, unknown> | null => {
  if (!Array.isArray(input.$snapshot_data) || input.$snapshot_data.length > 1000) return null;
  const snapshots = input.$snapshot_data.map((value) => sanitizeReplayEvent(value)).filter(Boolean);
  if (!snapshots.length || JSON.stringify(snapshots).length > 512000) return null;
  const properties: Record<string, unknown> = {
    $snapshot_data: snapshots,
    $snapshot_bytes: new TextEncoder().encode(JSON.stringify(snapshots)).length,
    $snapshot_host: 'pitchcrew',
    $process_person_profile: false,
    $geoip_disable: true,
  };
  for (const key of ['token', 'distinct_id', '$session_id', '$window_id', '$lib', '$lib_version'])
    if (typeof input[key] === 'string') properties[key] = input[key];
  return properties;
};
/** Replay uses a content-free wireframe; no source DOM attribute survives serialization. */
export const replaySurfaces = [
  'board',
  'crew',
  'chat',
  'inbox',
  'profile',
  'skills',
  'routines',
  'insights',
  'activity',
  'settings',
  'landing',
] as const;
export const replayBlockSelector = [
  'main:not([data-replay-public])',
  '[data-replay-block]',
  '#agent-browser-panel',
  '.sidebar-conversations',
  '.recent-group',
  '[data-replay-category="crew"]',
  '[role="dialog"]:not(:has([data-slot="sidebar"]))',
  '[data-slot="sheet-content"]:not(:has([data-slot="sidebar"]))',
  '[role="menu"]',
  '[role="listbox"]',
  '[role="tooltip"]',
  '[role="alert"]',
  'iframe',
  'canvas',
  'video',
  'audio',
  'img',
  'object',
  'embed',
  'script',
  'style',
  'input',
  'textarea',
  'select',
  '[contenteditable]',
].join(',');

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as ObjectValue) : {};
const number = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(-100000, Math.min(100000, Math.round(value * 10) / 10))
    : fallback;
const id = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) ? value : -1;
const stylePattern =
  /^position:(?:absolute|relative);left:-?[\d.]+px;top:-?[\d.]+px;width:[\d.]+px;height:[\d.]+px;overflow:hidden;box-sizing:border-box;background:#f5f2ec;border:1px solid #c8c2b8;$/;
const rootTags = new Set(['html', 'head', 'body']);

export type ReplayGeometry = (id: number) => Record<string, string>;
