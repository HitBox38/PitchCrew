import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNotebookPlan,
  bindNotebookCells,
  listNotebookDefinitions,
} from './notebooks-library.ts';
import type { NotebookOptions } from './notebooks-library.ts';
import { notebooksCommand } from './notebooks.ts';

function options(): NotebookOptions {
  return {
    project_id: 295060,
    cutoff: '2026-10-12T19:00:00Z',
    catalog: 'unavailable',
    listing_complete: true,
    existing_notebooks: [],
    bindings: [
      ...[
        'usage',
        'adoption',
        'workflow',
        'diagnostics',
        'web',
        'heatmaps',
        'ai_mcp',
        'engineering',
      ].map((key, index) => ({ kind: 'dashboard', key, id: index + 1, project_id: 295060 })),
      { kind: 'insight', key: 'sanitized_errors', id: '79UVPFXi', project_id: 295060 },
    ],
  };
}

test('both notebooks produce actual native create, dashboard, insight, markdown and SQL inputs', () => {
  for (const definition of listNotebookDefinitions()) {
    const plan = buildNotebookPlan(definition.key, options());
    assert.equal(plan.create.tool, 'notebooks-create-markdown');
    assert.ok(plan.create.input.title.length <= 256);
    assert.equal(
      plan.cells.filter((cell) => cell.input.cell_type === 'sql').length,
      definition.queries.length,
    );
    assert.equal(
      plan.cells.filter((cell) => cell.input.cell_type === 'component').length,
      definition.dashboards.length,
    );
    assert.equal(
      plan.cells.find((cell) => cell.input.cell_type === 'saved_insight')!.input.insight_short_id,
      '79UVPFXi',
    );
    assert.ok(plan.cells.length <= 50);
    for (const cell of plan.cells) {
      assert.equal(cell.tool, 'notebooks-add-cell');
      if (cell.input.cell_type === 'markdown') assert.equal(cell.input.title, undefined);
      else assert.ok(cell.input.title!.length > 0 && cell.input.title!.length <= 120);
      assert.notEqual(cell.input.cell_type, 'python');
      if (cell.input.cell_type === 'component')
        assert.deepEqual(Object.keys(cell.input.props!), ['id', 'view']);
    }
    assert.match(plan.create.input.markdown, /widgets show their own|widgets retain their own/);
    assert.match(JSON.stringify(plan), /noncanonical/);
  }
});

test('seven elapsed days stay pinned across Jerusalem DST and all SQL has row limits', () => {
  const input = options();
  input.cutoff = '2026-10-25T07:00:00Z';
  const plan = buildNotebookPlan('weekly_review', input);
  assert.equal(plan.window.start, '2026-10-18T07:00:00.000Z');
  assert.equal(plan.window.end, '2026-10-25T07:00:00.000Z');
  for (const { input: cell } of plan.cells.filter((step) => step.input.cell_type === 'sql')) {
    assert.match(cell.code!, /timestamp >= toDateTime\('2026-10-18 07:00:00', 'UTC'\)/);
    assert.match(cell.code!, /timestamp < toDateTime\('2026-10-25 07:00:00', 'UTC'\)/);
    assert.match(cell.code!, /'Asia\/Jerusalem'/);
    assert.match(cell.code!, /LIMIT 100$/);
    assert.doesNotMatch(
      cell.code!,
      /now\(\)|\{\{|SELECT \*|persons|person_id|\$ai_input|\$ai_output|\$mcp_intent|error_message/,
    );
  }
});

test('activation resolves only notebook short IDs and ends with a read verification', () => {
  const plan = buildNotebookPlan('release_check', options());
  const bound = bindNotebookCells(plan, 'aBc12345');
  assert.equal(
    'notebook_id' in bound[0].input ? bound[0].input.notebook_id : undefined,
    'aBc12345',
  );
  assert.deepEqual(bound.at(-1), { tool: 'notebooks-get', input: { short_id: 'aBc12345' } });
  assert.equal(plan.cells[0].input.notebook_id, undefined);
  for (const id of [
    'https://example.com/notebooks/id',
    '12345678-1234-1234-1234-123456789012',
    '',
    '{created.id}',
  ])
    assert.throws(() => bindNotebookCells(plan, id));
});

test('wrong project, incomplete listing, duplicates and missing resources block creation', () => {
  const mutations = [
    (input: NotebookOptions) => {
      input.project_id = 123;
    },
    (input: NotebookOptions) => {
      input.listing_complete = false;
    },
    (input: NotebookOptions) => {
      input.existing_notebooks = [{ title: listNotebookDefinitions()[0].title }];
    },
    (input: NotebookOptions) => {
      input.bindings = input.bindings.filter((item) => item.key !== 'web');
    },
    (input: NotebookOptions) => {
      input.bindings.push(input.bindings[0]);
    },
    (input: NotebookOptions) => {
      input.bindings[0].project_id = 123;
    },
    (input: NotebookOptions) => {
      input.bindings[0].id = '999570';
    },
    (input: NotebookOptions) => {
      input.bindings[0].id = 0;
    },
    (input: NotebookOptions) => {
      input.bindings.at(-1)!.id = 6355551;
    },
    (input: NotebookOptions) => {
      input.bindings.at(-1)!.id = 'unsafe"<Person>';
    },
    (input: NotebookOptions) => {
      input.catalog = 'approved';
    },
    (input: NotebookOptions) => {
      input.markdown = 'private profile';
    },
    (input: NotebookOptions) => {
      input.bindings[0].email = 'private@example.invalid';
    },
  ];
  for (const mutate of mutations) {
    const input = options();
    mutate(input);
    assert.throws(() => buildNotebookPlan('weekly_review', input));
  }
});

test('date validation blocks normalized impossible dates and executable interpolation', () => {
  for (const cutoff of [
    '2026-02-30T19:00:00Z',
    '2026-10-12',
    '2026-10-12T19:00:00+00:00',
    "2026-10-12T19:00:00Z'); DROP TABLE events;--",
    '2026-10-12T19:00:00.123Z',
  ]) {
    const input = options();
    input.cutoff = cutoff;
    assert.throws(() => buildNotebookPlan('weekly_review', input));
  }
});

test('offline CLI reads reviewed bindings only and accepts no execution or credential arguments', () => {
  let readCount = 0;
  const read = () => {
    readCount++;
    return JSON.stringify(options());
  };
  assert.equal(notebooksCommand(['list'], read).length, 2);
  assert.equal(readCount, 0);
  assert.equal(
    notebooksCommand(['plan', 'weekly_review', '/fictional/bindings.json'], read).project_id,
    295060,
  );
  assert.equal(readCount, 1);
  assert.throws(() => notebooksCommand(['apply', 'weekly_review', 'bindings.json'], read));
  assert.throws(() =>
    notebooksCommand(['plan', 'weekly_review', 'bindings.json', '--token', 'private'], read),
  );
  assert.throws(() =>
    notebooksCommand(['plan', 'weekly_review', 'bindings.json'], () => 'x'.repeat(100_001)),
  );
});
