import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, expect, test } from 'vitest';
import { sourceArguments, sourceExecArguments } from '../src/process.ts';

const execute = promisify(execFile);
const bun = process.env.PITCHCREW_BUN_EXECUTABLE ?? 'bun';
const repository = fileURLToPath(new URL('../../../', import.meta.url));
const configuration = join(repository, 'bunfig.toml');
const processModule = new URL('../src/process.ts', import.meta.url).href;
const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const directories: string[] = [];
const servers: Server[] = [];
const missingPackage = 'pitchcrew-bun-isolation-missing-fixture-209f4a';
const markerVariable = 'PITCHCREW_CALLER_STARTUP_FIXTURE';

afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
  for (const directory of directories.splice(0)) {
    if (
      dirname(directory) !== resolve(tmpdir()) ||
      !basename(directory).startsWith('pitchcrew-source-launch-')
    )
      throw new Error('Unsafe source launch fixture cleanup path.');
    await rm(directory, { recursive: true, force: true });
  }
});

const fixture = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-source-launch-'));
  directories.push(directory);
  const caller = join(directory, 'Caller with spaces');
  const application = join(directory, 'application');
  await mkdir(caller);
  await mkdir(application);
  const marker = join(caller, 'preload-marker.txt');
  const preload = join(caller, 'preload.ts');
  await writeFile(
    preload,
    `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'executed');`,
  );
  await writeFile(join(caller, 'bunfig.toml'), 'preload = ["./preload.ts"]\n');
  await writeFile(join(caller, '.env'), `${markerVariable}=caller-env\n`);
  const entry = join(application, 'entry.ts');
  await writeFile(
    entry,
    `let missing = false;
try { await import(${JSON.stringify(missingPackage)}); } catch { missing = true; }
console.log(JSON.stringify({ env: process.env.${markerVariable} ?? null, missing, args: process.argv.slice(2) }));`,
  );
  const requests: string[] = [];
  const registry = createServer((request, response) => {
    requests.push(request.url ?? '');
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end('{"error":"Fictional package is absent."}');
  });
  await new Promise<void>((resolve) => registry.listen(0, '127.0.0.1', resolve));
  servers.push(registry);
  const address = registry.address();
  if (!address || typeof address === 'string') throw new Error('Missing registry fixture port.');
  const env = {
    ...process.env,
    [markerVariable]: undefined,
    BUN_CONFIG_REGISTRY: `http://127.0.0.1:${address.port}`,
    npm_config_registry: `http://127.0.0.1:${address.port}`,
  };
  return { directory, caller, entry, marker, requests, env };
};

const bunArguments = async (entry: string, args: string[] = []) => {
  const { stdout } = await execute(
    bun,
    [
      '--no-env-file',
      '--no-install',
      `--config=${configuration}`,
      '--eval',
      `import { sourceArguments } from ${JSON.stringify(processModule)};
console.log(JSON.stringify(sourceArguments(${JSON.stringify(entry)}, ...${JSON.stringify(args)})));`,
    ],
    { cwd: repository, timeout: 10000, windowsHide: true },
  );
  return JSON.parse(stdout) as string[];
};

test('retains the Node loader and literal source arguments', () => {
  expect(process.versions.bun).toBeUndefined();
  expect(sourceExecArguments()).toEqual(['--import', import.meta.resolve('tsx')]);
  expect(
    sourceArguments('/fixture/entry.ts', 'literal argument', '--home', '/fixture/home'),
  ).toEqual([
    '--import',
    import.meta.resolve('tsx'),
    '/fixture/entry.ts',
    'literal argument',
    '--home',
    '/fixture/home',
  ]);
});

test('the caller fixture detects Bun preloads, dotenv loading and automatic package lookups', async () => {
  const state = await fixture();
  const { stdout } = await execute(bun, [state.entry], {
    cwd: state.caller,
    env: state.env,
    timeout: 10000,
    windowsHide: true,
  });
  expect(existsSync(state.marker)).toBe(true);
  expect(JSON.parse(stdout)).toMatchObject({ env: 'caller-env', missing: true });
  expect(state.requests).toContain(`/${missingPackage}`);
});

test('Bun source launches ignore caller startup files and never auto-install missing packages', async () => {
  const state = await fixture();
  const args = await bunArguments(state.entry, ['literal argument', '--home', 'fictional home']);
  expect(args).toContain(`--config=${configuration}`);
  const { stdout } = await execute(bun, args, {
    cwd: state.caller,
    env: state.env,
    timeout: 10000,
    windowsHide: true,
  });
  expect(JSON.parse(stdout)).toEqual({
    env: null,
    missing: true,
    args: ['literal argument', '--home', 'fictional home'],
  });
  expect(existsSync(state.marker)).toBe(false);
  expect(state.requests).toEqual([]);
  expect(existsSync(join(state.caller, 'node_modules'))).toBe(false);
  expect(existsSync(join(dirname(state.entry), 'node_modules'))).toBe(false);
});

test('generated external MCP commands cannot execute startup code from their client cwd', async () => {
  const state = await fixture();
  const workspace = join(state.directory, 'workspace');
  const args = await bunArguments(cli, ['mcp', 'config', '--home', workspace, '--port', '4417']);
  const { stdout } = await execute(bun, args, {
    cwd: repository,
    env: state.env,
    timeout: 10000,
    windowsHide: true,
  });
  const command = JSON.parse(stdout).mcpServers.pitchcrew as { command: string; args: string[] };
  expect(command.args).toContain(`--config=${configuration}`);
  await expect(
    execute(command.command, command.args, {
      cwd: state.caller,
      env: state.env,
      timeout: 10000,
      windowsHide: true,
    }),
  ).rejects.toThrow('External MCP is disabled.');
  expect(existsSync(state.marker)).toBe(false);
  expect(state.requests).toEqual([]);
});
