import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { buildNotebookPlan, listNotebookDefinitions } from './notebooks-library.ts';

type ReadBindings = (path: string, encoding: 'utf8') => string;
type NotebookCommandResult =
  | ReturnType<typeof listNotebookDefinitions>
  | ReturnType<typeof buildNotebookPlan>;
export function notebooksCommand(
  args: ['list'],
  read?: ReadBindings,
): ReturnType<typeof listNotebookDefinitions>;
export function notebooksCommand(
  args: ['plan', string, string],
  read?: ReadBindings,
): ReturnType<typeof buildNotebookPlan>;
export function notebooksCommand(args: string[], read?: ReadBindings): NotebookCommandResult;
export function notebooksCommand(
  args: string[],
  read: ReadBindings = readFileSync,
): NotebookCommandResult {
  if (args.length === 1 && args[0] === 'list') return listNotebookDefinitions();
  if (args.length !== 3 || args[0] !== 'plan')
    throw new Error('Usage: notebooks.ts list | plan <key> <verified-bindings.json>');
  const content = read(args[2], 'utf8');
  if (Buffer.byteLength(content) > 100_000) throw new Error('Bindings file too large');
  return buildNotebookPlan(args[1], JSON.parse(content));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.stdout.write(`${JSON.stringify(notebooksCommand(process.argv.slice(2)), null, 2)}\n`);
  } catch {
    process.stderr.write(
      'Notebook plan rejected; check command, project, timestamp, listing and verified bindings.\n',
    );
    process.exitCode = 1;
  }
}
