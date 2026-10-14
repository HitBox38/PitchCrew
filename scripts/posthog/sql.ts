import { pathToFileURL } from 'node:url';
import { buildSqlPlan, listSqlQueries } from './sql-library.ts';

type SqlCommandResult = ReturnType<typeof listSqlQueries> | ReturnType<typeof buildSqlPlan>;
export function sqlCommand(args: ['list']): ReturnType<typeof listSqlQueries>;
export function sqlCommand(args: ['plan', string, ...string[]]): ReturnType<typeof buildSqlPlan>;
export function sqlCommand(args: string[]): SqlCommandResult;
export function sqlCommand(args: string[]): SqlCommandResult {
  if (args.length === 1 && args[0] === 'list') return listSqlQueries();
  if (args[0] !== 'plan' || !args[1])
    throw new Error(
      'Usage: sql.ts list | plan <key> [--days 1..30] [--limit 1..200] [--timezone Asia/Jerusalem|UTC] [--catalog unavailable|no_match|proposed]',
    );
  const options: Record<string, unknown> = {};
  for (let index = 2; index < args.length; index += 2) {
    const name = args[index].replace(/^--/, '');
    if (
      !args[index].startsWith('--') ||
      !['days', 'limit', 'timezone', 'catalog'].includes(name) ||
      !args[index + 1]
    )
      throw new Error('Invalid option');
    if (Object.hasOwn(options, name)) throw new Error('Duplicate option');
    options[name] =
      ['days', 'limit'].includes(name) && /^\d+$/.test(args[index + 1])
        ? Number(args[index + 1])
        : args[index + 1];
  }
  return buildSqlPlan(args[1], options);
}

// Offline only: no token, HTTP client, arbitrary SQL/file input or execution mode.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.stdout.write(`${JSON.stringify(sqlCommand(process.argv.slice(2)), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
