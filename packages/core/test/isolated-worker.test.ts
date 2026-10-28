import { execFile } from 'node:child_process';
import { copyFile, link, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { nodeExecutable } from '../src/isolated-worker.ts';

let directory: string;
let runner: string;
const node = nodeExecutable();
let bun = process.env.PITCHCREW_BUN_EXECUTABLE ?? 'bun';
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pitchcrew-isolated-worker-'));
  const { stdout } = await promisify(execFile)(bun, ['-p', 'process.execPath']);
  bun = stdout.trim();
  runner = join(directory, 'runner.mts');
  await writeFile(runner, source);
});
afterAll(async () => {
  if (
    dirname(directory) !== resolve(tmpdir()) ||
    !basename(directory).startsWith('pitchcrew-isolated-worker-')
  )
    throw new Error('Unsafe isolated worker fixture cleanup path.');
  await rm(directory, { recursive: true, force: true });
});

const run = async (
  runtime: 'Node' | 'Bun',
  mode: string,
  env: Record<string, string | undefined> = {},
  executable?: string,
  script = runner,
) => {
  const { stdout } = await promisify(execFile)(
    executable ?? (runtime === 'Node' ? node : bun),
    [
      ...(runtime === 'Node'
        ? ['--import', import.meta.resolve('tsx')]
        : ['--no-env-file', '--no-install']),
      script,
      mode,
    ],
    {
      env: { ...process.env, PITCHCREW_NODE_EXECUTABLE: node, ...env },
      timeout: 15000,
      maxBuffer: 16000,
      windowsHide: true,
    },
  );
  return JSON.parse(stdout.trim());
};

describe.each(['Node', 'Bun'] as const)('%s isolated workers', (runtime) => {
  it('preserves nested binary input and output through a genuine Node worker', async () => {
    expect(await run(runtime, 'message')).toMatchObject({
      bytes: [0, 128, 255],
      buffer: [1, 2, 254],
      arrayBuffer: [3, 4, 253],
      outputIsTypedArray: true,
      inputIsTypedArray: true,
      nested: { text: 'Fictional fixture', missing: true, integer: '123' },
      workerIsNode: true,
    });
  });

  it('forwards worker failures with their code', async () => {
    expect(await run(runtime, 'error')).toMatchObject({
      message: 'Fictional worker failure',
      code: 'FIXTURE_WORKER_ERROR',
    });
  });

  it('enforces the V8 worker heap limit without terminating the caller', async () => {
    const error = await run(runtime, 'heap');
    expect(error.code).toBe('ERR_WORKER_OUT_OF_MEMORY');
    expect(error.message).toContain('memory limit');
  });

  it('waits for infinite work and its helper to exit on termination', async () => {
    const result = await run(runtime, 'terminate');
    expect(result.code).toBeTypeOf('number');
    expect(result.hostAlive).toBe(false);
  });

  it('can terminate while the helper is still starting', async () => {
    expect(await run(runtime, 'early-terminate')).toMatchObject({ code: expect.any(Number) });
  });

  it('stops isolated work if its owning process exits', async () => {
    const { pid } = await run(runtime, 'disconnect');
    await vi.waitFor(() => expect(alive(pid)).toBe(false), { timeout: 3000 });
  });
});

it('rejects a relative Node override rather than running an unbounded worker', async () => {
  await expect(run('Bun', 'message', { PITCHCREW_NODE_EXECUTABLE: 'node' })).rejects.toThrow(
    'absolute path',
  );
});

it('rejects Bun masquerading as the Node helper', async () => {
  await expect(run('Bun', 'message', { PITCHCREW_NODE_EXECUTABLE: bun })).rejects.toThrow(
    'must be genuine Node.js',
  );
});

it('finds genuine Node on the source launch PATH without an override', async () => {
  expect(
    await run('Bun', 'message', { PITCHCREW_NODE_EXECUTABLE: undefined, PATH: dirname(node) }),
  ).toMatchObject({ workerIsNode: true });
});

it('finds the bundled Node sibling after a login service drops the source environment', async () => {
  const bundledBun = await stageRuntimes(join(directory, 'runtime'));
  expect(
    await run('Bun', 'message', { PITCHCREW_NODE_EXECUTABLE: undefined, PATH: '' }, bundledBun),
  ).toMatchObject({ workerIsNode: true });
});

it('loads a materialized source package below node_modules in the installed app layout', async () => {
  const runtime = join(directory, 'materialized', 'runtime');
  const bundledBun = await stageRuntimes(runtime);
  const core = join(runtime, 'node_modules', '@pitchcrew', 'core');
  await mkdir(join(core, 'src'), { recursive: true });
  await writeFile(
    join(core, 'package.json'),
    JSON.stringify({ name: '@pitchcrew/core', type: 'module' }),
  );
  for (const name of [
    'isolated-worker',
    'isolated-worker-node',
    'isolated-worker-codec',
    'isolated-worker-host',
  ])
    await copyFile(new URL(`../src/${name}.ts`, import.meta.url), join(core, 'src', `${name}.ts`));
  await symlink(
    dirname(dirname(fileURLToPath(import.meta.resolve('tsx')))),
    join(runtime, 'node_modules', 'tsx'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  const packagedRunner = join(directory, 'materialized', 'runner.mts');
  await writeFile(
    packagedRunner,
    source.replace(
      new URL('../src/isolated-worker.ts', import.meta.url).href,
      pathToFileURL(join(core, 'src', 'isolated-worker.ts')).href,
    ),
  );
  expect(
    await run(
      'Bun',
      'message',
      { PITCHCREW_NODE_EXECUTABLE: undefined, PATH: '' },
      bundledBun,
      packagedRunner,
    ),
  ).toMatchObject({ workerIsNode: true });
});

const stageRuntimes = async (runtime: string) => {
  const extension = process.platform === 'win32' ? '.exe' : '';
  const bundledBun = join(runtime, 'bun', `bun${extension}`);
  for (const [source, target] of [
    [bun, bundledBun],
    [node, join(runtime, 'node', `node${extension}`)],
  ]) {
    await mkdir(dirname(target), { recursive: true });
    await link(source, target).catch(() => copyFile(source, target));
  }
  return bundledBun;
};

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const source = `
import { IsolatedWorker } from ${JSON.stringify(new URL('../src/isolated-worker.ts', import.meta.url).href)};
import { once } from 'node:events';
const mode = process.argv[2];
const scripts = {
  message: \
    "import {parentPort,workerData} from 'node:worker_threads';" +
    "parentPort.postMessage({bytes:workerData.bytes,buffer:workerData.buffer,arrayBuffer:new Uint8Array(workerData.arrayBuffer)," +
    "inputIsTypedArray:workerData.bytes instanceof Uint8Array,nested:{text:workerData.nested.text," +
    "missing:workerData.nested.missing===undefined,integer:String(workerData.nested.integer)}," +
    "workerIsNode:!process.versions.bun&&process.release.name==='node'});",
  error: "throw Object.assign(new Error('Fictional worker failure'),{code:'FIXTURE_WORKER_ERROR'});",
  heap: "const values=[];while(true)values.push(new Array(100000).fill('bounded fixture heap'));",
  terminate: "import {parentPort} from 'node:worker_threads';parentPort.postMessage({pid:process.pid});while(true){}",
  'early-terminate': "while(true){}",
  disconnect: "import {parentPort} from 'node:worker_threads';parentPort.postMessage({pid:process.pid});while(true){}",
};
const worker = new IsolatedWorker(new URL('data:text/javascript,'+encodeURIComponent(scripts[mode])),{
  execArgv:[],resourceLimits:{maxOldGenerationSizeMb:16},workerData:{
    bytes:new Uint8Array([0,128,255]),buffer:Buffer.from([1,2,254]),
    arrayBuffer:Uint8Array.from([3,4,253]).buffer,
    nested:{text:'Fictional fixture',missing:undefined,integer:123n}
  }
});
try {
  if(mode==='early-terminate') console.log(JSON.stringify({code:await worker.terminate()}));
  else if(mode==='error'||mode==='heap') {
    const [error]=await once(worker,'error');
    await worker.terminate();
    console.log(JSON.stringify({message:error.message,code:error.code}));
  } else {
    const [message]=await once(worker,'message');
    if(mode==='disconnect') {console.log(JSON.stringify(message));process.exit(0);}
    if(mode==='terminate') {
      const code=await worker.terminate();
      let hostAlive=false;
      if(message.pid!==process.pid)try{process.kill(message.pid,0);hostAlive=true;}catch{}
      console.log(JSON.stringify({code,hostAlive}));
    } else console.log(JSON.stringify({...message,bytes:Array.from(message.bytes),buffer:Array.from(message.buffer),
      arrayBuffer:Array.from(message.arrayBuffer),outputIsTypedArray:message.bytes instanceof Uint8Array}));
  }
} finally {await worker.terminate();}
`;
