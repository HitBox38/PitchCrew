import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';

export const processMock = async () => {
  const actual =
    await vi.importActual<typeof import('../../src/process.ts')>('../../src/process.ts');
  return {
    ...actual,
    detectCli: vi.fn(async (id, command) => ({
      id,
      available: true,
      // OpenCode takes its 1.x flags only from a readable 1.x version; other CLIs accept this one.
      version: id === 'opencode' ? 'opencode 1.14.0 (fixture)' : '2026.09.26-fixture',
      detail: command,
    })),
    runCliText: vi.fn((...args: Parameters<typeof actual.runCliText>) => {
      const [command, flags, ...rest] = args;
      return actual.runCliText(
        process.execPath,
        [fileURLToPath(new URL('../fixtures/runtime-cli.ts', import.meta.url)), command, ...flags],
        ...rest,
      );
    }),
  };
};
export const acpMock = async () => {
  const actual = await vi.importActual<typeof import('../../src/acp.ts')>('../../src/acp.ts');
  return {
    ...actual,
    runAcpText: vi.fn((...args: Parameters<typeof actual.runAcpText>) => {
      const [, flags, ...rest] = args;
      return actual.runAcpText(
        process.execPath,
        [fileURLToPath(new URL('../fixtures/acp-cli.ts', import.meta.url)), ...flags],
        ...rest,
      );
    }),
  };
};
