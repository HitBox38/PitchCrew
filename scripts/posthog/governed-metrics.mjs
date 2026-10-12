import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { buildSqlPlan } from './sql-library.mjs';

const resource = JSON.parse(
  readFileSync(new URL('../../posthog/governed-metrics/resources.json', import.meta.url), 'utf8'),
);
export function definitionHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function inventoryIndex(inventory, field) {
  const rows = inventory?.[field] ?? [];
  if (!Array.isArray(rows)) throw new Error('Inventory must contain arrays');
  const map = new Map();
  for (const row of rows) {
    if (!row || typeof row.name !== 'string' || map.has(row.name))
      throw new Error('Invalid or duplicate inventory name');
    map.set(row.name, row);
  }
  return map;
}

/** Network-free proposal planner. It cannot approve, overwrite, materialize, or send data. */
export function buildGovernancePlan(options = {}) {
  for (const key of Object.keys(options))
    if (!['days', 'timezone', 'inventory'].includes(key))
      throw new Error('Unknown governance option');
  const days = options.days ?? resource.default_days;
  const timezone = options.timezone ?? 'Asia/Jerusalem';
  const inventory = options.inventory ?? {};
  if (inventory.project_id !== undefined && inventory.project_id !== resource.project_id)
    throw new Error('Wrong inventory project');
  const metrics = inventoryIndex(inventory, 'metrics');
  const views = inventoryIndex(inventory, 'views');
  const catalogComplete = inventory.catalog_complete === true;
  const viewsComplete = inventory.views_complete === true;
  const blockers = [];
  if (!catalogComplete)
    blockers.push(
      'Read the complete governed catalog with data_catalog:read before creating proposals.',
    );
  if (!viewsComplete)
    blockers.push(
      'Read the complete view inventory before native view-create, which upserts names.',
    );
  if (inventory.metric_create_schema_verified !== true)
    blockers.push(
      'Inspect the current metric-create input schema after data_catalog:write is granted.',
    );
  if (inventory.owner_assignment_verified !== true)
    blockers.push('Resolve the accountable human owner in the current native metric schema.');

  const models = resource.model_query_keys.map((key) => {
    const source = buildSqlPlan(key, { days: resource.model_days, timezone, limit: 200 });
    const name = `pitchcrew_${key}_daily_v1_${timezone === 'UTC' ? 'utc' : 'jerusalem'}`;
    const query = { kind: 'HogQLQuery', query: source.tool_input.query };
    const existing = views.get(name);
    const conflict = existing && definitionHash(existing.query) !== definitionHash(query);
    if (conflict)
      blockers.push(`Existing model ${name} has a different definition; preserve it for review.`);
    if (inventory.source_coverage?.[key] !== 'verified')
      blockers.push(`Verify real source coverage for ${key}; absent data cannot certify a model.`);
    return {
      name,
      query_key: key,
      status: 'proposed',
      version: 1,
      coverage: source.coverage,
      caveats: source.caveats,
      definition_hash: definitionHash(query),
      action: conflict ? 'blocked_collision' : existing ? 'reuse_existing' : 'create_virtual_view',
      tool: 'view-create',
      tool_input: {
        name,
        query,
        description: `Proposed v1 ${source.name.toLowerCase()}; trailing 30 elapsed days, ${timezone} day buckets. No certification.`,
        sync_frequency: null,
      },
    };
  });

  const proposals = resource.metrics.map((metric) => {
    const source = buildSqlPlan(metric.query_key, { days, timezone, limit: 200 });
    const dimensions = metric.dimensions
      .map((dimension) => `${dimension} AS ${dimension}`)
      .join(', ');
    const query = `SELECT ${dimensions},\n    ${metric.expression} AS value\nFROM (\n${source.tool_input.query}\n)\nORDER BY ${metric.dimensions.join(', ')} LIMIT 200`;
    const definition = { kind: 'HogQLQuery', query };
    const name = `pitchcrew_${metric.key}_${days}d_v${metric.version}_${timezone === 'UTC' ? 'utc' : 'jerusalem'}`;
    const existing = metrics.get(name);
    const exact =
      existing &&
      definitionHash(existing.definition) === definitionHash(definition) &&
      existing.unit === metric.unit;
    const approved = exact && existing.status === 'approved' && existing.is_drifted === false;
    const conflict = existing && !exact;
    if (existing && exact && !approved)
      blockers.push(`Existing metric ${name} needs proposal or drift review before deployment.`);
    if (conflict)
      blockers.push(`Existing metric ${name} differs; preserve its identity and review drift.`);
    return {
      name,
      status: 'proposed',
      canonical: false,
      owner: metric.owner,
      version: metric.version,
      unit: metric.unit,
      grain: metric.grain,
      window: source.window,
      query_key: metric.query_key,
      model_name: models.find((model) => model.query_key === metric.query_key).name,
      definition_hash: definitionHash(definition),
      caveats: source.caveats,
      action: conflict
        ? 'blocked_collision'
        : approved
          ? 'use_native_approved_runner'
          : existing
            ? 'review_existing_proposal_or_drift'
            : 'propose_after_schema_validation',
      candidate: {
        name,
        display_name: `${metric.display_name} (${days}-day window)`,
        description: metric.description,
        unit: metric.unit,
        definition,
      },
      candidate_is_validated_tool_input: false,
    };
  });
  return {
    project_id: resource.project_id,
    status: 'proposed_noncanonical',
    canonical: false,
    network: 'none',
    days,
    timezone,
    ready_for_proposals: blockers.length === 0,
    blockers: [...new Set(blockers)],
    models,
    metrics: proposals,
    required_review: [
      'Recheck source schema and compiler with read-only, zero-width queries before any write.',
      'Validate metric candidates against the current native tool schema and assign the human owner.',
      'Create only proposed metrics; use existing approved non-drifted definitions through the native catalog runner.',
      'Read back all writes; human promotion uses the separate native confirmed-action flow.',
      'Do not materialize, certify sources, infer joins or approve metrics from this plan.',
    ],
  };
}

export function parseGovernanceArgs(args) {
  const options = {};
  const seen = new Set();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (seen.has(key)) throw new Error('Duplicate governance option');
    seen.add(key);
    if (!value || !['--days', '--timezone', '--inventory'].includes(key))
      throw new Error('Expected --days, --timezone or --inventory and a value');
    if (key === '--days') options.days = Number(value);
    if (key === '--timezone') options.timezone = value;
    if (key === '--inventory') options.inventory = JSON.parse(readFileSync(value, 'utf8'));
  }
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.stdout.write(
      `${JSON.stringify(buildGovernancePlan(parseGovernanceArgs(process.argv.slice(2))), null, 2)}\n`,
    );
  } catch {
    process.stderr.write(
      'Invalid governance plan input. No network requests or writes performed.\n',
    );
    process.exitCode = 1;
  }
}
