import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import {
  buildEndpointDefinition,
  buildEndpointRun,
  buildEndpointVariablePlan,
  listEndpointDefinitions,
  planEndpointDeployment,
  validateEndpointResult,
} from './endpoint-library.mjs';
import { endpointCommand } from './endpoints.mjs';

const variable = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Pitchcrew lookback days',
  code_name: 'pitchcrew_lookback_days',
  type: 'Number',
  default_value: 7,
};
const snapshot = () => ({
  project_id: 295060,
  complete: true,
  results: [],
  variable,
  catalog: 'proposed',
});

test('aggregate endpoints reuse SQL definitions and bind a native Number variable literally', () => {
  for (const { key } of listEndpointDefinitions()) {
    const payload = buildEndpointDefinition(key, variable);
    assert.equal(payload.query.kind, 'HogQLQuery');
    assert.deepEqual(payload.query.variables, {
      [variable.id]: { code_name: variable.code_name, variableId: variable.id },
    });
    assert.match(
      payload.query.query,
      /least\(30, greatest\(1, toInt\(\{variables.pitchcrew_lookback_days\}\)\)\)/,
    );
    assert.equal(
      (payload.query.query.match(/FROM events/g) ?? []).length,
      (payload.query.query.match(/timestamp >= now\(\) - INTERVAL 30 DAY/g) ?? []).length,
    );
    assert.match(payload.query.query, /LIMIT 200$/);
    assert.doesNotMatch(
      payload.query.query.slice(0, payload.query.query.indexOf('FROM')),
      /distinct_id|person_id|uuid|trace_id|SELECT\s+\*/i,
    );
    assert.equal(payload.is_materialized, false);
    assert.equal(payload.data_freshness_seconds, 86400);
    assert.match(payload.description, /Noncanonical/);
  }
});

test('native variable creation is a separate exact typed-tool plan', () => {
  assert.deepEqual(buildEndpointVariablePlan().tool_input, {
    name: variable.name,
    type: 'Number',
    default_value: 7,
  });
  for (const change of [
    { id: 'invented' },
    { code_name: 'other' },
    { type: 'String' },
    { default_value: 30 },
    { name: 'Other' },
    { token: 'fictional-secret' },
  ])
    assert.throws(() => buildEndpointDefinition('action_mix', { ...variable, ...change }));
});

test('runtime defaults and strict bounds reject SQL injection, identity filters and connection overrides', () => {
  assert.deepEqual(buildEndpointRun('action_mix'), {
    name: 'pitchcrew_accepted_actions_daily',
    variables: { pitchcrew_lookback_days: 7 },
    limit: 100,
    refresh: 'cache',
  });
  assert.equal(buildEndpointRun('run_health', { days: 30, limit: 200 }).limit, 200);
  for (const days of [0, 31, Infinity, NaN, 1.5, '7', '7; SELECT *'])
    assert.throws(() => buildEndpointRun('action_mix', { days }));
  for (const limit of [0, 201, -1, '100'])
    assert.throws(() => buildEndpointRun('action_mix', { limit }));
  for (const name of [
    'query',
    'where',
    'offset',
    'refresh',
    'token',
    'user_id',
    'connectionId',
    'timezone',
  ])
    assert.throws(() => buildEndpointRun('action_mix', { [name]: 'private-value' }));
  assert.throws(() => buildEndpointRun('SELECT * FROM events'));
});

test('complete unfiltered project snapshot is mandatory; approved catalog definitions cannot be bypassed', () => {
  for (const change of [
    { complete: false },
    { project_id: 1 },
    { catalog: 'approved' },
    { catalog: 'unavailable' },
    { results: null },
    { is_active: true },
  ])
    assert.throws(() => planEndpointDeployment('action_mix', { ...snapshot(), ...change }));
  const plan = planEndpointDeployment('action_mix', snapshot());
  assert.equal(plan.action, 'create');
  assert.equal(plan.tool, 'endpoint-create');
  assert.equal(plan.verification.tool, 'endpoint-run');
  assert.equal(plan.definition_status, 'noncanonical');
});

test('existing matching endpoints are noops; duplicates, settings and query drift block mutation', () => {
  const desired = buildEndpointDefinition('action_mix', variable);
  const existing = { ...desired, is_active: true, current_version: 1, id: 'native-id' };
  assert.equal(
    planEndpointDeployment('action_mix', { ...snapshot(), results: [existing] }).action,
    'noop',
  );
  assert.throws(() =>
    planEndpointDeployment('action_mix', { ...snapshot(), results: [existing, existing] }),
  );
  for (const change of [
    { is_active: false },
    { query: { kind: 'HogQLQuery', query: 'SELECT * FROM events' } },
    { data_freshness_seconds: 900 },
    { is_materialized: true },
    { tags: [] },
  ])
    assert.throws(() =>
      planEndpointDeployment('action_mix', {
        ...snapshot(),
        results: [{ ...existing, ...change }],
      }),
    );
});

test('aggregate result version and columns are enforced; empty rows retain unknown coverage', () => {
  const result = {
    endpoint_version: 1,
    columns: [
      'day',
      'accepted_chat_sends',
      'accepted_workflow_launches',
      'completed_ui_source_scans',
    ],
    results: [],
    hasMore: false,
  };
  assert.equal(validateEndpointResult('action_mix', result, 1).coverage, 'unknown_no_observations');
  assert.equal(
    validateEndpointResult('action_mix', { ...result, results: [['2026-10-12', 1, 0, 0]] }, 1)
      .coverage,
    'observations_available',
  );
  for (const change of [
    { endpoint_version: 2 },
    { columns: ['raw_properties'] },
    { hasMore: true },
    { results: [['2026-10-12', 'private-text', 0, 0]] },
    { results: [['private-date', 1, 0, 0]] },
    { results: [['2026-10-12', Infinity, 0, 0]] },
    { results: Array(201).fill(['2026-10-12', 1, 0, 0]) },
  ])
    assert.throws(() => validateEndpointResult('action_mix', { ...result, ...change }, 1));
});

test('CLI accepts only documented plans, rejects duplicates and never accesses credentials', () => {
  assert.equal(
    endpointCommand(['run-plan', 'action_mix', '--days', '1']).tool_input.variables
      .pitchcrew_lookback_days,
    1,
  );
  assert.equal(
    endpointCommand(['plan', 'action_mix', 'fixture'], () => snapshot()).action,
    'create',
  );
  for (const args of [
    [],
    ['apply'],
    ['run-plan', 'action_mix', '--days'],
    ['run-plan', 'action_mix', '--days', '7', '--days', '8'],
    ['run-plan', 'action_mix', '--token', 'secret'],
    ['list', 'extra'],
  ])
    assert.throws(() => endpointCommand(args));
  const result = spawnSync(
    process.execPath,
    ['scripts/posthog/endpoints.mjs', 'run-plan', 'run_health'],
    {
      cwd: new URL('../..', import.meta.url),
      encoding: 'utf8',
      env: { ...process.env, POSTHOG_PERSONAL_API_KEY: 'fictional-do-not-print' },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).tool, 'endpoint-run');
  assert.doesNotMatch(result.stdout + result.stderr, /fictional-do-not-print/);
});
