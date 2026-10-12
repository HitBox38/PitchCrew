import { readFileSync } from 'node:fs';
import { buildSqlPlan } from './sql-library.mjs';

const resource = JSON.parse(
  readFileSync(new URL('../../posthog/endpoints/resources.json', import.meta.url), 'utf8'),
);
const definitions = new Map(resource.endpoints.map((definition) => [definition.key, definition]));
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected an object');
  if (Object.keys(value).some((key) => !keys.includes(key))) throw new Error('Unknown option');
}

function integer(value, fallback, maximum) {
  value ??= fallback;
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum)
    throw new Error(`Expected an integer from 1 to ${maximum}`);
  return value;
}

function definition(key) {
  const found = definitions.get(key);
  if (!found) throw new Error('Unknown endpoint key');
  return found;
}

export function listEndpointDefinitions() {
  return resource.endpoints.map((entry) => ({ ...entry, definition_status: 'noncanonical' }));
}

/** Preparation only. Never creates a variable or accesses credentials. */
export function buildEndpointVariablePlan() {
  const { code_name: _codeName, ...input } = resource.variable;
  return {
    project_id: resource.project_id,
    tool: 'sql-variables-create',
    tool_input: input,
    expected_code_name: resource.variable.code_name,
  };
}

/** Accept a verified native variable record; do not invent persistent native IDs. */
export function buildEndpointDefinition(key, variable) {
  definition(key);
  object(variable, ['id', 'name', 'code_name', 'type', 'default_value']);
  if (
    !uuid.test(variable.id ?? '') ||
    variable.code_name !== resource.variable.code_name ||
    variable.type !== 'Number' ||
    variable.default_value !== 7 ||
    variable.name !== resource.variable.name
  )
    throw new Error('Native variable record does not match the reviewed definition');
  const base = buildSqlPlan(key, {
    days: 30,
    limit: 200,
    timezone: resource.timezone,
    catalog: 'proposed',
  });
  // Keep the independent 30-day predicate even if a caller bypasses our validation.
  // HogQL binds the Number variable as a literal; no client-supplied SQL is interpolated.
  const query = base.tool_input.query.replaceAll(
    'timestamp >= now() - INTERVAL 30 DAY AND timestamp < now()',
    'timestamp >= now() - INTERVAL 30 DAY AND timestamp < now()\n    AND timestamp >= subtractDays(now(), least(30, greatest(1, toInt({variables.pitchcrew_lookback_days}))))',
  );
  return {
    name: definition(key).name,
    description: `Noncanonical aggregate: ${base.name}. Opt-in observations only; absent rows mean unknown coverage. Trailing 1–30 elapsed days, Jerusalem day buckets; cache up to 24 hours.`,
    query: {
      kind: 'HogQLQuery',
      query,
      variables: { [variable.id]: { code_name: variable.code_name, variableId: variable.id } },
    },
    data_freshness_seconds: resource.data_freshness_seconds,
    is_materialized: false,
    tags: ['pitchcrew', 'noncanonical', 'aggregate-only'],
  };
}

/** Strict caller contract, independently bounded by the saved query itself. */
export function buildEndpointRun(key, options = {}) {
  object(options, ['days', 'limit']);
  return {
    name: definition(key).name,
    variables: { [resource.variable.code_name]: integer(options.days, 7, 30) },
    limit: integer(options.limit, 100, 200),
    refresh: 'cache',
  };
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    );
  return value;
}

// Native serialization adds null optional fields, the resolved default value,
// and sorts tags. These are equivalent; substantive extra fields still drift.
function comparableEndpoint(value, variable) {
  const query = { ...value.query };
  for (const [name, field] of Object.entries(query)) if (field === null) delete query[name];
  if (query.variables?.[variable.id]) {
    query.variables = { ...query.variables, [variable.id]: { ...query.variables[variable.id] } };
    const binding = query.variables[variable.id];
    if (binding.value === 7) delete binding.value;
    if (binding.isNull === false) delete binding.isNull;
  }
  return { ...value, query, tags: Array.isArray(value.tags) ? [...value.tags].sort() : value.tags };
}

/** Require an unfiltered, fully paginated export and fail closed on name/query drift. */
export function planEndpointDeployment(key, snapshot) {
  object(snapshot, ['project_id', 'complete', 'results', 'variable', 'catalog']);
  if (
    snapshot.project_id !== resource.project_id ||
    snapshot.complete !== true ||
    !Array.isArray(snapshot.results)
  )
    throw new Error('Complete PitchCrew endpoint snapshot required');
  if (!['no_match', 'proposed'].includes(snapshot.catalog))
    throw new Error('Consult the governed catalog before preparing deployment');
  const desired = buildEndpointDefinition(key, snapshot.variable);
  const matches = snapshot.results.filter((item) => item.name === desired.name);
  if (matches.length > 1) throw new Error('Duplicate native endpoint name');
  const existing = matches[0];
  let action = 'create';
  if (existing) {
    const comparable = Object.fromEntries(
      Object.keys(desired).map((name) => [name, existing[name]]),
    );
    if (
      existing.is_active !== true ||
      JSON.stringify(stable(comparableEndpoint(comparable, snapshot.variable))) !==
        JSON.stringify(stable(comparableEndpoint(desired, snapshot.variable)))
    )
      throw new Error('Endpoint drift: review the native version before changing it');
    action = 'noop';
  }
  return {
    project_id: resource.project_id,
    definition_status: 'noncanonical',
    action,
    model_reference: definition(key).model_reference,
    ...(action === 'create' ? { tool: 'endpoint-create', tool_input: desired } : {}),
    verification: {
      tool: 'endpoint-run',
      tool_input: buildEndpointRun(key),
      require_columns_and_endpoint_version: true,
      require_variable_binding_test: true,
    },
  };
}

/** Validate an aggregate result before consumers use it; no raw object/string fields. */
export function validateEndpointResult(key, response, expectedVersion) {
  const schemas = {
    action_mix: [
      'day',
      'accepted_chat_sends',
      'accepted_workflow_launches',
      'completed_ui_source_scans',
    ],
    request_health: [
      'day',
      'observed_requests',
      'successes',
      'aborted',
      'failures',
      'non_aborted_failure_percent',
      'success_p50_ms',
      'success_p95_ms',
    ],
    run_health: [
      'day',
      'mode',
      'observed_terminal_runs',
      'completed',
      'failed',
      'cancelled',
      'measured_runs',
      'measured_p50_ms',
      'measured_p95_ms',
    ],
    ci_attempt_health: [
      'day',
      'completed_attempts',
      'successful_attempts',
      'repeat_attempts',
      'success_percent',
      'p50_job_span_seconds',
      'p95_job_span_seconds',
    ],
  };
  definition(key);
  if (
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < 1 ||
    response?.endpoint_version !== expectedVersion
  )
    throw new Error('Unexpected endpoint version');
  if (
    JSON.stringify(response.columns) !== JSON.stringify(schemas[key]) ||
    !Array.isArray(response.results) ||
    response.results.length > 200 ||
    response.hasMore !== false
  )
    throw new Error('Unexpected aggregate result shape');
  for (const row of response.results) {
    if (!Array.isArray(row) || row.length !== schemas[key].length)
      throw new Error('Invalid aggregate row');
    row.forEach((value, index) => {
      const name = schemas[key][index];
      if (
        name === 'day'
          ? typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
          : name === 'mode'
            ? !['chat', 'workflow'].includes(value)
            : value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
      )
        throw new Error('Invalid aggregate cell');
    });
  }
  return {
    definition_status: 'noncanonical',
    coverage: response.results.length ? 'observations_available' : 'unknown_no_observations',
    rows: response.results,
  };
}
