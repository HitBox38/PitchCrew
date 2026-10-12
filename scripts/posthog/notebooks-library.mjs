import { readFileSync } from 'node:fs';
import { buildSqlPlan } from './sql-library.mjs';

const resource = JSON.parse(
  readFileSync(new URL('../../posthog/notebooks/resources.json', import.meta.url), 'utf8'),
);
const notebooks = new Map(resource.notebooks.map((definition) => [definition.key, definition]));
const shortIdPattern = /^[A-Za-z0-9]{1,64}$/;

function exactKeys(value, keys, label) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw new Error(`Invalid ${label}`);
}

function utcCutoff(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value))
    throw new Error('cutoff must be a whole-second UTC ISO timestamp');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value.replace('Z', '.000Z'))
    throw new Error('Invalid cutoff date');
  return date;
}

function binding(bindings, kind, key) {
  const matches = bindings.filter((item) => item.kind === kind && item.key === key);
  if (matches.length !== 1) throw new Error(`One verified ${kind} binding required for ${key}`);
  const item = matches[0];
  exactKeys(item, ['kind', 'key', 'id', 'project_id'], 'resource binding');
  if (item.project_id !== resource.project_id)
    throw new Error('Resource belongs to a different project');
  if (
    kind === 'dashboard'
      ? !Number.isSafeInteger(item.id) || item.id < 1
      : typeof item.id !== 'string' || !shortIdPattern.test(item.id)
  )
    throw new Error(`Invalid ${kind} identity`);
  return item.id;
}

export function listNotebookDefinitions() {
  return resource.notebooks.map(({ key, title, dashboards, insights, queries }) => ({
    key,
    title,
    dashboards,
    insights,
    queries,
  }));
}

/** Build native-tool inputs only. Never performs network requests or starts compute. */
export function buildNotebookPlan(key, options) {
  exactKeys(
    options,
    ['project_id', 'cutoff', 'bindings', 'existing_notebooks', 'listing_complete', 'catalog'],
    'notebook options',
  );
  const definition = notebooks.get(key);
  if (!definition) throw new Error('Unknown notebook key');
  if (options.project_id !== resource.project_id)
    throw new Error('Confirm PitchCrew EU project 295060');
  if (options.listing_complete !== true || !Array.isArray(options.existing_notebooks))
    throw new Error('A complete current notebook listing is required');
  if (options.existing_notebooks.some((item) => !item || typeof item.title !== 'string'))
    throw new Error('Invalid existing notebook listing');
  if (options.existing_notebooks.some((item) => item.title === definition.title))
    throw new Error(
      'Notebook already exists; inspect with notebooks-get and update existing cells instead',
    );
  if (!Array.isArray(options.bindings)) throw new Error('Verified resource bindings required');
  const end = utcCutoff(options.cutoff);
  const start = new Date(end.getTime() - resource.window_days * 86400000);
  const sqlDate = (date) =>
    `toDateTime('${date.toISOString().slice(0, 19).replace('T', ' ')}', 'UTC')`;
  const steps = [];
  for (const dashboard of definition.dashboards)
    steps.push({
      tool: 'notebooks-add-cell',
      input: {
        cell_type: 'component',
        tag_name: 'Dashboard',
        props: { id: binding(options.bindings, 'dashboard', dashboard), view: 'summary' },
        title: `${dashboard} dashboard · saved filters`,
      },
    });
  for (const insight of definition.insights)
    steps.push({
      tool: 'notebooks-add-cell',
      input: {
        cell_type: 'saved_insight',
        insight_short_id: binding(options.bindings, 'insight', insight),
        title: `${insight} · saved filters`,
      },
    });
  for (const queryKey of definition.queries) {
    const query = buildSqlPlan(queryKey, {
      days: 7,
      limit: 100,
      timezone: resource.timezone,
      catalog: options.catalog,
    });
    const code = query.tool_input.query
      .replaceAll('now() - INTERVAL 7 DAY', sqlDate(start))
      .replaceAll('now()', sqlDate(end));
    if (/now\(\)|\{\{|INTERVAL/.test(code)) throw new Error('Unresolved query window');
    const markdown = `## ${query.name}\n\nNoncanonical. Source coverage at preparation: ${query.coverage}. Recheck after deployment/import.\n\n${query.caveats.map((caveat) => `- ${caveat}`).join('\n')}`;
    steps.push({ tool: 'notebooks-add-cell', input: { cell_type: 'markdown', markdown } });
    steps.push({
      tool: 'notebooks-add-cell',
      input: { cell_type: 'sql', code, dataframe_name: `pitchcrew_${queryKey}`, title: query.name },
    });
  }
  steps.push({
    tool: 'notebooks-add-cell',
    input: { cell_type: 'markdown', markdown: definition.closing_markdown },
  });
  if (steps.length > resource.maximum_cells)
    throw new Error('Notebook exceeds native 50-cell limit');
  return {
    project_id: resource.project_id,
    key,
    definition_status: resource.definition_status,
    window: {
      start: start.toISOString(),
      end: end.toISOString(),
      days: 7,
      timezone: resource.timezone,
      maximum_rows: 100,
    },
    requires_before_activation: [
      'Confirm connected project and current tool schemas.',
      'Review bindings using dashboard-get/insight-get; these supplied IDs are assertions, not proof of API access.',
      'Consult the complete governed catalog; approved non-drifted matches supersede these noncanonical SQL cells.',
      'Verify source availability; no rows means unknown coverage, not health.',
      'Create only after integration is ready. SQL add-cell runs immediately; no Python/compute is requested.',
    ],
    create: {
      tool: 'notebooks-create-markdown',
      input: {
        title: definition.title,
        markdown: `${definition.markdown}\n\nPinned UTC window: ${start.toISOString()} (inclusive) to ${end.toISOString()} (exclusive).`,
      },
    },
    cells: steps,
    verify: { tool: 'notebooks-get' },
  };
}

/** Resolve the short ID returned by native creation after inspecting its response. */
export function bindNotebookCells(plan, notebookId) {
  if (typeof notebookId !== 'string' || !shortIdPattern.test(notebookId))
    throw new Error('Expected notebook short ID, not UUID or URL');
  return plan.cells
    .map((step) => ({ tool: step.tool, input: { notebook_id: notebookId, ...step.input } }))
    .concat({ tool: 'notebooks-get', input: { short_id: notebookId } });
}
