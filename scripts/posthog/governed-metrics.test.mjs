import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { buildGovernancePlan, parseGovernanceArgs } from './governed-metrics.mjs';
import { buildSqlPlan } from './sql-library.mjs';

function verifiedInventory(plan) {
  return {
    project_id: 295060,
    catalog_complete: true,
    views_complete: true,
    metric_create_schema_verified: true,
    owner_assignment_verified: true,
    metrics: [],
    views: [],
    source_coverage: Object.fromEntries(plan.models.map((model) => [model.query_key, 'verified'])),
  };
}

test('default plan contains reusable virtual models and noncanonical proposals without network', () => {
  const plan = buildGovernancePlan();
  assert.equal(plan.days, 7);
  assert.equal(plan.timezone, 'Asia/Jerusalem');
  assert.equal(plan.models.length, 7);
  assert.equal(plan.metrics.length, 11);
  assert.equal(plan.network, 'none');
  assert.equal(plan.ready_for_proposals, false);
  assert.ok(plan.blockers.some((blocker) => blocker.includes('complete governed catalog')));
  for (const model of plan.models) {
    assert.equal(model.tool_input.sync_frequency, null);
    assert.match(model.tool_input.query.query, /INTERVAL 30 DAY/);
    assert.doesNotMatch(model.tool_input.query.query, /SELECT \*/);
  }
  for (const metric of plan.metrics) {
    assert.equal(metric.canonical, false);
    assert.equal(metric.status, 'proposed');
    assert.equal(metric.candidate_is_validated_tool_input, false);
    assert.match(metric.candidate.definition.query, /INTERVAL 7 DAY/);
    assert.doesNotMatch(metric.candidate.definition.query, /person_id|SELECT properties[,\s]/);
  }
});

test('denominators and missing measurements preserve shared reviewed SQL', () => {
  const plan = buildGovernancePlan();
  const request = plan.metrics.find((metric) => metric.query_key === 'request_health');
  assert.match(
    request.candidate.definition.query,
    /nullIf\(countIf\(properties.result != 'aborted'\), 0\)/,
  );
  const runs = plan.metrics.find((metric) => metric.name.includes('run_failure_percent'));
  assert.match(runs.candidate.definition.query, /failed \/ nullIf\(observed_terminal_runs, 0\)/);
  assert.match(runs.candidate.description, /Cancellations remain in the denominator/);
  const duration = plan.metrics.find((metric) => metric.name.includes('run_measured_p95'));
  assert.match(duration.candidate.definition.query, /if\(measured_runs > 0/);
});

test('bounded windows and approved units cannot be injected through CLI options', () => {
  for (const days of [0, 31, 1.5, '7', Infinity, NaN])
    assert.throws(() => buildGovernancePlan({ days }));
  assert.throws(() => buildGovernancePlan({ timezone: "UTC'); DROP TABLE events" }));
  assert.throws(() => buildGovernancePlan({ apply: true }));
  assert.throws(() => parseGovernanceArgs(['--apply', 'true']));
  assert.throws(() => parseGovernanceArgs(['--days', '7', '--days', '30']));
  assert.throws(() => buildGovernancePlan({ inventory: { project_id: 123 } }));
  assert.equal(buildGovernancePlan({ days: 30, timezone: 'UTC' }).metrics[0].window.days, 30);
});

test('complete verified inventory permits proposals but grants no promotion or automatic apply', () => {
  const initial = buildGovernancePlan();
  const plan = buildGovernancePlan({ inventory: verifiedInventory(initial) });
  assert.equal(plan.ready_for_proposals, true);
  assert.equal(plan.canonical, false);
  assert.equal(plan.metrics[0].action, 'propose_after_schema_validation');
  assert.equal(plan.metrics[0].candidate.status, undefined);
});

test('model upsert collisions are blocked and equal definitions are reused', () => {
  const first = buildGovernancePlan();
  const inventory = verifiedInventory(first);
  inventory.views = [first.models[0].tool_input];
  assert.equal(buildGovernancePlan({ inventory }).models[0].action, 'reuse_existing');
  inventory.views[0].query = { kind: 'HogQLQuery', query: 'SELECT 0 AS value' };
  const collision = buildGovernancePlan({ inventory });
  assert.equal(collision.models[0].action, 'blocked_collision');
  assert.equal(collision.ready_for_proposals, false);
});

test('approved exact definitions route through native runner; drift never becomes canonical', () => {
  const first = buildGovernancePlan();
  const inventory = verifiedInventory(first);
  inventory.metrics = [{ ...first.metrics[0].candidate, status: 'approved', is_drifted: false }];
  const reused = buildGovernancePlan({ inventory }).metrics[0];
  assert.equal(reused.action, 'use_native_approved_runner');
  assert.equal(reused.canonical, false);
  inventory.metrics[0].is_drifted = true;
  assert.equal(
    buildGovernancePlan({ inventory }).metrics[0].action,
    'review_existing_proposal_or_drift',
  );
  inventory.metrics[0].definition = { kind: 'HogQLQuery', query: 'SELECT 0 AS value' };
  assert.equal(buildGovernancePlan({ inventory }).metrics[0].action, 'blocked_collision');
});

test('incomplete coverage and duplicate inventories fail closed', () => {
  const first = buildGovernancePlan();
  const inventory = verifiedInventory(first);
  inventory.source_coverage.request_health = 'prepared_not_collected';
  assert.equal(buildGovernancePlan({ inventory }).ready_for_proposals, false);
  inventory.metrics = [{ name: 'duplicate' }, { name: 'duplicate' }];
  assert.throws(() => buildGovernancePlan({ inventory }));
});

test('CLI defaults dry-run and rejects credential-like unknown arguments without printing them', () => {
  const result = spawnSync(process.execPath, ['scripts/posthog/governed-metrics.mjs'], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).network, 'none');
  const privateValue = 'fictional_private_admin_key';
  const invalid = spawnSync(
    process.execPath,
    ['scripts/posthog/governed-metrics.mjs', '--token', privateValue],
    { encoding: 'utf8' },
  );
  assert.equal(invalid.status, 1);
  assert.ok(!(invalid.stdout + invalid.stderr).includes(privateValue));
});

test('30-day reusable views retain the full bounded aggregate relation without a consumer cap', () => {
  for (const timezone of ['Asia/Jerusalem', 'UTC']) {
    for (const model of buildGovernancePlan({ timezone }).models) {
      const expected = buildSqlPlan(model.query_key, {
        days: 30,
        timezone,
        limit: 200,
      }).tool_input.query.replace(/\s+LIMIT 200\s*$/, '');
      assert.equal(model.tool_input.query.query, expected);
      assert.doesNotMatch(model.tool_input.query.query, /\bLIMIT\s+\d+/i);
      assert.match(
        model.tool_input.query.query,
        /timestamp >= now\(\) - INTERVAL 30 DAY AND timestamp < now\(\)/,
      );
      assert.equal(model.tool_input.sync_frequency, null);
    }
  }
});

test('metric projection limits only final results and leaves every inner aggregate group available', () => {
  for (const days of [7, 30]) {
    const plan = buildGovernancePlan({ days });
    for (const metric of plan.metrics) {
      const query = metric.candidate.definition.query;
      const inner = query.match(/FROM \(\n([\s\S]*)\n\)\nORDER BY/)[1];
      const expected = buildSqlPlan(metric.query_key, {
        days,
        limit: 200,
      }).tool_input.query.replace(/\s+LIMIT 200\s*$/, '');
      assert.equal(inner, expected);
      assert.doesNotMatch(inner, /\bLIMIT\s+\d+/i);
      assert.equal((query.match(/\bLIMIT\s+200/g) ?? []).length, 1);
      assert.match(query, /LIMIT 200$/);
      assert.equal(metric.result_may_be_truncated, true);
      assert.equal(metric.canonical, false);
      assert.ok(metric.caveats.some((caveat) => caveat.includes('verify completeness')));
    }
  }
});

test('an existing truncated model definition is a collision rather than silently reused', () => {
  const initial = buildGovernancePlan();
  const inventory = verifiedInventory(initial);
  inventory.views = [
    {
      ...initial.models[0].tool_input,
      query: { kind: 'HogQLQuery', query: `${initial.models[0].tool_input.query.query} LIMIT 200` },
    },
  ];
  const plan = buildGovernancePlan({ inventory });
  assert.equal(plan.models[0].action, 'blocked_collision');
  assert.equal(plan.ready_for_proposals, false);
});
