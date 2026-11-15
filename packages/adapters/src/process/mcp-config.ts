import { randomUUID } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Writes an MCP configuration containing the scoped run token to a private file in the
 * launch's isolated run folder, so the token never appears on the process command line.
 * Each launch gets its own name, and the file is removed once the CLI exits.
 */
export const withMcpConfigFile = async <T>(
  directory: string,
  config: unknown,
  use: (path: string) => Promise<T>,
): Promise<T> => {
  const path = resolve(directory, `pitchcrew-mcp-${randomUUID()}.json`);
  await writeFile(path, JSON.stringify(config), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  try {
    return await use(path);
  } finally {
    await rm(path, { force: true }).catch(() => {});
  }
};
