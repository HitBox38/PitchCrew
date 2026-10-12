import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { buildNotebookPlan, listNotebookDefinitions } from './notebooks-library.mjs';

export function notebooksCommand(args, read = readFileSync) {
  if (args.length === 1 && args[0] === 'list') return listNotebookDefinitions();
  if (args.length !== 3 || args[0] !== 'plan')
    throw new Error('Usage: notebooks.mjs list | plan <key> <verified-bindings.json>');
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
