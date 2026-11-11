// Writes docs/state-machines.md from the lifecycle tables in packages/core/src/lifecycles.ts.
// Run `bun run docs:state-machines` after changing a table; a core test fails while they differ.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { entityLifecycles, lifecycles, type Lifecycle } from '../packages/core/src/lifecycles.ts';

export const stateMachinesPath = fileURLToPath(
  new URL('../docs/state-machines.md', import.meta.url),
);

const enforced = new Set<unknown>(Object.values(entityLifecycles));

const diagram = (lifecycle: Lifecycle<string, string>): string =>
  [
    '```mermaid',
    'stateDiagram-v2',
    ...lifecycle.initial.map((state) => `  [*] --> ${state}`),
    ...lifecycle.states.flatMap((from) => lifecycle.graph[from].map((to) => `  ${from} --> ${to}`)),
    ...lifecycle.final.map((state) => `  ${state} --> [*]`),
    '```',
  ].join('\n');

const section = (lifecycle: Lifecycle<string, string>): string => {
  const groups = Object.entries(lifecycle.groups);
  const check =
    lifecycle.name === 'Job'
      ? 'Checked by `board.move`. User and `manageWorkflow` corrections may record any status.'
      : lifecycle.name === 'Message delivery'
        ? 'Checked on every `chat_request` write, per recipient.'
        : enforced.has(lifecycle)
          ? 'Checked on every board write.'
          : 'Not checked by the board.';
  return [
    `## ${lifecycle.name}`,
    check,
    diagram(lifecycle),
    ...(groups.length
      ? [
          'Named sets:',
          groups.map(([name, states]) => `- \`${name}\`: ${states.join(', ')}`).join('\n'),
        ]
      : []),
  ].join('\n\n');
};

export const renderStateMachines = (): string =>
  [
    '# State machines',
    'Generated from `packages/core/src/lifecycles.ts` by `bun run docs:state-machines`. Do not edit by hand.',
    [
      'Each diagram is the complete list of moves a status may make. Saving an entity without',
      'changing its status is always allowed. Tests refuse any other move',
      '(`PITCHCREW_LIFECYCLES=enforce`); an installed daemon saves it and warns once, so a move',
      'the tables missed never stops work. To add a move, change the table, run the generator and',
      'cover the new edge with a test.',
    ].join('\n'),
    ...lifecycles.map(section),
  ].join('\n\n') + '\n';

if (process.argv[1] === fileURLToPath(import.meta.url))
  writeFileSync(stateMachinesPath, renderStateMachines());
