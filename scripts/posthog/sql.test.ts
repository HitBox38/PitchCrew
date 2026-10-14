import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { buildSqlPlan, listSqlQueries } from './sql-library.ts';
import { sqlCommand } from './sql.ts';

test('weekly defaults produce a content-free exact read-only MCP payload', () => {
  const plan = buildSqlPlan('request_health');
  assert.deepEqual(plan.window, {
    kind: 'trailing_elapsed_days',
    days: 7,
    timezone: 'Asia/Jerusalem',
    limit: 100,
  });
  assert.deepEqual(Object.keys(plan.tool_input).sort(), ['context', 'query', 'truncate']);
  assert.equal(plan.tool, 'execute-sql');
  assert.equal(plan.definition_status, 'noncanonical');
  assert.match(
    plan.tool_input.query,
    /timestamp >= now\(\) - INTERVAL 7 DAY AND timestamp < now\(\)/,
  );
  assert.match(plan.tool_input.query, /nullIf\(countIf\(properties.result != 'aborted'\), 0\)/);
  assert.equal(plan.tool_input.truncate, true);
});

test('range and limit boundaries reject injection, coercion and unbounded scans', () => {
  for (const days of [0, 31, -1, 1.5, NaN, Infinity, '7', '7 DAY; SELECT *'])
    assert.throws(() => buildSqlPlan('action_mix', { days }));
  for (const limit of [0, 201, -1, 2.5, NaN, Infinity, '100'])
    assert.throws(() => buildSqlPlan('action_mix', { limit }));
  const query = buildSqlPlan('action_mix', { days: 30, limit: 200, timezone: 'UTC' }).tool_input
    .query;
  assert.match(query, /INTERVAL 30 DAY/);
  assert.match(query, /LIMIT 200$/);
  assert.match(query, /toTimeZone\(timestamp, 'UTC'\)/);
});

test('arbitrary SQL, raw parameters, connection overrides and tokens are rejected', () => {
  assert.throws(() => buildSqlPlan('SELECT properties FROM events'));
  for (const name of [
    'query',
    'event',
    'connectionId',
    'sendRawQuery',
    'token',
    'after',
    'date_from',
  ])
    assert.throws(() => buildSqlPlan('action_mix', { [name]: 'private-value' }));
  for (const timezone of ['Europe/London', "UTC'); SELECT *", ''])
    assert.throws(() => buildSqlPlan('action_mix', { timezone }));
  for (const options of [null, [], 'private-value'])
    assert.throws(() => buildSqlPlan('action_mix', options));
});

test('governance states remain noncanonical and approved definitions cannot be bypassed', () => {
  assert.throws(() => buildSqlPlan('request_health', { catalog: 'approved' }));
  assert.match(
    buildSqlPlan('request_health', { catalog: 'no_match' }).tool_input.context,
    /governed catalog consulted: no match/,
  );
  assert.match(
    buildSqlPlan('request_health', { catalog: 'proposed' }).tool_input.context,
    /proposed definition only/,
  );
  assert.equal(
    buildSqlPlan('request_health', { catalog: 'proposed' }).definition_status,
    'noncanonical',
  );
});

test('every reviewed query bounds each events scan and exports no raw content or IDs', () => {
  for (const { key } of listSqlQueries()) {
    const query = buildSqlPlan(key).tool_input.query;
    assert.equal(
      (query.match(/FROM events/g) ?? []).length,
      (query.match(/timestamp >= now\(\) - INTERVAL 7 DAY AND timestamp < now\(\)/g) ?? []).length,
      key,
    );
    assert.match(query, /LIMIT 100$/);
    assert.doesNotMatch(
      query,
      /SELECT\s+\*|SELECT\s+properties\s|distinct_id|person_id|elements_chain|\$ai_input|\$ai_output|\$current_url|trace_id|logs\b|JOIN|;/i,
    );
    const outerSelect = query.slice(0, query.indexOf('FROM'));
    assert.doesNotMatch(
      outerSelect.replace('properties.mode AS mode', ''),
      /uuid|properties\.\w+(?:\s*,|\s+AS)/i,
      key,
    );
  }
});

test('missing run timings do not become measured zero durations', () => {
  const query = buildSqlPlan('run_health').tool_input.query;
  assert.match(query, /properties.duration_ms IS NOT NULL/);
  assert.match(query, /if\(measured_runs > 0/);
  assert.match(query, /NULL\) AS measured_p95_ms/);
  assert.doesNotMatch(query, /coalesce\(.*duration_ms.*0\)/);
});

test('repository UUID deduplication remains internal with bounded branch vocabulary', () => {
  for (const key of ['ci_attempt_health', 'pr_delivery']) {
    const query = buildSqlPlan(key).tool_input.query;
    assert.match(query, /GROUP BY uuid/);
    assert.doesNotMatch(query.slice(0, query.indexOf('FROM')), /uuid/);
    assert.match(query, /properties.repository = 'pitchcrew'/);
  }
  assert.match(
    buildSqlPlan('pr_delivery').tool_input.query,
    /properties.target_branch IN \('dev', 'main'\)/,
  );
});

test('CLI parses only documented options and rejects duplicates, free SQL and missing values', () => {
  assert.equal(sqlCommand(['plan', 'action_mix', '--days', '1', '--limit', '1']).window.days, 1);
  assert.equal(sqlCommand(['list']).length, 7);
  for (const args of [
    [],
    ['execute', 'action_mix'],
    ['plan', 'action_mix', '--days'],
    ['plan', 'action_mix', '--days', '7', '--days', '8'],
    ['plan', 'action_mix', '--token', 'secret'],
    ['plan', 'action_mix', '--days', '7;SELECT'],
    ['list', 'extra'],
  ])
    assert.throws(() => sqlCommand(args));
});

test('actual CLI produces JSON plans without accessing a supplied private token', () => {
  const result = spawnSync(process.execPath, ['scripts/posthog/sql.ts', 'plan', 'action_mix'], {
    cwd: new URL('../..', import.meta.url),
    encoding: 'utf8',
    env: { ...process.env, POSTHOG_PERSONAL_API_KEY: 'fictional-do-not-print' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).project_id, 295060);
  assert.doesNotMatch(result.stdout + result.stderr, /fictional-do-not-print/);
  const failure = spawnSync(
    process.execPath,
    ['scripts/posthog/sql.ts', 'plan', 'action_mix', '--days', '31'],
    { cwd: new URL('../..', import.meta.url), encoding: 'utf8' },
  );
  assert.equal(failure.status, 1);
  assert.equal(failure.stdout, '');
});
