import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  buildEndpointRun,
  buildEndpointVariablePlan,
  listEndpointDefinitions,
  planEndpointDeployment,
} from './endpoint-library.mjs';

export function endpointCommand(args, read = (path) => JSON.parse(readFileSync(path, 'utf8'))) {
  if (args.length === 1 && args[0] === 'list') return listEndpointDefinitions();
  if (args.length === 1 && args[0] === 'variable-plan') return buildEndpointVariablePlan();
  if (args.length === 3 && args[0] === 'plan')
    return planEndpointDeployment(args[1], read(args[2]));
  if (args[0] !== 'run-plan' || !args[1])
    throw new Error(
      'Usage: endpoints.mjs list | variable-plan | plan <key> <complete-snapshot.json> | run-plan <key> [--days 1..30] [--limit 1..200]',
    );
  const options = {};
  for (let index = 2; index < args.length; index += 2) {
    const name = args[index].replace(/^--/, '');
    if (
      !args[index].startsWith('--') ||
      !['days', 'limit'].includes(name) ||
      !/^\d+$/.test(args[index + 1] ?? '') ||
      Object.hasOwn(options, name)
    )
      throw new Error('Invalid option');
    options[name] = Number(args[index + 1]);
  }
  return {
    project_id: 295060,
    tool: 'endpoint-run',
    tool_input: buildEndpointRun(args[1], options),
  };
}

// Deliberately offline: the coordinator executes reviewed typed MCP calls later.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.stdout.write(`${JSON.stringify(endpointCommand(process.argv.slice(2)), null, 2)}\n`);
  } catch {
    // Never echo file content, native descriptions or private credential values.
    process.stderr.write('Invalid endpoint plan; check the documented contract.\n');
    process.exitCode = 1;
  }
}
