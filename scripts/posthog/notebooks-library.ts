import resource from '../../posthog/notebooks/resources.json' with { type: 'json' };
import { buildSqlPlan } from './sql-library.ts';

const exactKeys: (
  value: unknown,
  keys: string[],
  label: string,
) => asserts value is Record<string, unknown> = (
  value: unknown,
  keys: string[],
  label: string,
): asserts value is Record<string, unknown> => {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw new Error(`Invalid ${label}`);
};

const utcCutoff = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value))
    throw new Error('cutoff must be a whole-second UTC ISO timestamp');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value.replace('Z', '.000Z'))
    throw new Error('Invalid cutoff date');
  return date;
};

const binding = (bindings: NotebookBinding[], kind: string, key: string) => {
  const matches = bindings.filter((item) => item.kind === kind && item.key === key);
  if (matches.length !== 1) throw new Error(`One verified ${kind} binding required for ${key}`);
  const item = matches[0];
  exactKeys(item, ['kind', 'key', 'id', 'project_id'], 'resource binding');
  if (item.project_id !== resource.project_id)
    throw new Error('Resource belongs to a different project');
  if (
    kind === 'dashboard'
      ? typeof item.id !== 'number' || !Number.isSafeInteger(item.id) || item.id < 1
      : typeof item.id !== 'string' || !shortIdPattern.test(item.id)
  )
    throw new Error(`Invalid ${kind} identity`);
  return item.id;
};

export const listNotebookDefinitions = () => {
  return resource.notebooks.map(({ key, title, dashboards, insights, queries }) => ({
    key,
    title,
    dashboards,
    insights,
    queries,
  }));
};

/** Build native-tool inputs only. Never performs network requests or starts compute. */
export const buildNotebookPlan = (key: string, input: unknown) => {
  exactKeys(
    input,
    ['project_id', 'cutoff', 'bindings', 'existing_notebooks', 'listing_complete', 'catalog'],
    'notebook options',
  );
  const options = input as unknown as NotebookOptions;
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
  const sqlDate = (date: Date) =>
    `toDateTime('${date.toISOString().slice(0, 19).replace('T', ' ')}', 'UTC')`;
  const steps: NotebookStep[] = [];
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
};

/** Resolve the short ID returned by native creation after inspecting its response. */
export const bindNotebookCells = (
  plan: ReturnType<typeof buildNotebookPlan>,
  notebookId: string,
) => {
  if (typeof notebookId !== 'string' || !shortIdPattern.test(notebookId))
    throw new Error('Expected notebook short ID, not UUID or URL');
  const bound: {
    tool: string;
    input: (NotebookCell & { notebook_id: string }) | { short_id: string };
  }[] = plan.cells.map((step) => ({
    tool: step.tool,
    input: { notebook_id: notebookId, ...step.input },
  }));
  bound.push({ tool: 'notebooks-get', input: { short_id: notebookId } });
  return bound;
};

export interface NotebookBinding {
  kind: string;
  key: string;
  id: string | number;
  project_id: number;
  [key: string]: unknown;
}
export interface NotebookOptions {
  project_id: number;
  cutoff: string;
  bindings: NotebookBinding[];
  existing_notebooks: { title: string }[];
  listing_complete: boolean;
  catalog: string;
  [key: string]: unknown;
}
interface NotebookCell {
  cell_type: string;
  title?: string;
  tag_name?: string;
  props?: { id: string | number; view: string };
  insight_short_id?: string | number;
  markdown?: string;
  code?: string;
  dataframe_name?: string;
  notebook_id?: string;
}
interface NotebookStep {
  tool: string;
  input: NotebookCell;
}

const notebooks = new Map(resource.notebooks.map((definition) => [definition.key, definition]));
const shortIdPattern = /^[A-Za-z0-9]{1,64}$/;
