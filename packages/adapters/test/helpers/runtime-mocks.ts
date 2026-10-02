import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';

export async function processMock() {
  const actual =
    await vi.importActual<typeof import('../../src/process.ts')>('../../src/process.ts');
  return {
    ...actual,
    detectCli: vi.fn(async (id, command) => ({
      id,
      available: true,
      version: '2026.09.26-fixture',
      detail: command,
    })),
    runCliText: vi.fn((...args: Parameters<typeof actual.runCliText>) => {
      const [command, flags, ...rest] = args;
      return actual.runCliText(
        process.execPath,
        [fileURLToPath(new URL('../fixtures/runtime-cli.mjs', import.meta.url)), command, ...flags],
        ...rest,
      );
    }),
  };
}
export async function acpMock() {
  const actual = await vi.importActual<typeof import('../../src/acp.ts')>('../../src/acp.ts');
  return {
    ...actual,
    runAcp: vi.fn((...args: Parameters<typeof actual.runAcp>) => {
      const [, flags, ...rest] = args;
      return actual.runAcp(
        process.execPath,
        [fileURLToPath(new URL('../fixtures/acp-cli.mjs', import.meta.url)), ...flags],
        ...rest,
      );
    }),
    runAcpText: vi.fn((...args: Parameters<typeof actual.runAcpText>) => {
      const [, flags, ...rest] = args;
      return actual.runAcpText(
        process.execPath,
        [fileURLToPath(new URL('../fixtures/acp-cli.mjs', import.meta.url)), ...flags],
        ...rest,
      );
    }),
  };
}
