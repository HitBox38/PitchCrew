import resource from '../../posthog/sql/resources.json' with { type: 'json' };

export const listSqlQueries = () => {
  return resource.queries.map(({ key, name, sources, coverage, caveats }) => ({
    key,
    name,
    sources,
    coverage,
    caveats,
  }));
};

const boundedInteger = (value: unknown, fallback: number, maximum: number, name: string) => {
  value ??= fallback;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > maximum)
    throw new Error(`${name} must be an integer between 1 and ${maximum}`);
  return value;
};

/** Only reviewed aggregate templates are accepted. This is not an arbitrary SQL executor. */
export const buildSqlPlan = (key: string, input: unknown = {}) => {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Invalid options');
  const options = input as Record<string, unknown>;
  for (const name of Object.keys(options))
    if (!['days', 'limit', 'timezone', 'catalog'].includes(name))
      throw new Error(`Unknown option: ${name}`);
  const definition = queries.get(key);
  if (!definition) throw new Error('Unknown SQL query key');
  const days = boundedInteger(options.days, 7, 30, 'days');
  const limit = boundedInteger(options.limit, 100, 200, 'limit');
  const timezone = options.timezone ?? 'Asia/Jerusalem';
  const catalog = options.catalog ?? 'unavailable';
  if (typeof timezone !== 'string' || !timezones.includes(timezone))
    throw new Error('Unsupported timezone');
  if (typeof catalog !== 'string' || !catalogOutcomes.includes(catalog))
    throw new Error('Use the catalog runner for an approved metric');
  const query = definition.sql
    .replaceAll('{{days}}', String(days))
    .replaceAll('{{limit}}', String(limit))
    .replaceAll('{{timezone}}', timezone);
  if (/\{\{/.test(query)) throw new Error('Unresolved SQL placeholder');
  return {
    project_id: resource.project_id,
    key,
    name: definition.name,
    definition_status: 'noncanonical',
    window: { kind: 'trailing_elapsed_days', days, timezone, limit },
    coverage: definition.coverage,
    caveats: definition.caveats,
    requires_before_execution: [
      'Confirm the connected project is PitchCrew EU (295060).',
      'Consult the complete governed metric catalog; run an approved non-drifted match with its native catalog runner instead.',
      'Recheck source events/properties with read-data-schema after the release/import; absent observations mean unknown coverage.',
    ],
    tool: 'execute-sql',
    tool_input: {
      query,
      context: `PitchCrew reviewed aggregate ${key}; noncanonical. ${catalog === 'no_match' ? 'governed catalog consulted: no match' : catalog === 'proposed' ? 'governed catalog consulted: proposed definition only' : 'governed catalog unavailable: access not verified; check before execution'}. Bounded ${days}-day window, ${limit}-row limit; ${timezone} day buckets.`,
      truncate: true,
    },
  };
};

const queries = new Map(resource.queries.map((query) => [query.key, query]));
const catalogOutcomes = ['unavailable', 'no_match', 'proposed'];
const timezones = ['UTC', 'Asia/Jerusalem'];
