import { fileURLToPath } from 'node:url';

/** Keep source launches equivalent across the production Bun runtime and Node test fixtures. */
export const sourceArguments = (entry: string, ...args: string[]) => [
  ...sourceExecArguments(),
  entry,
  ...args,
];

export const sourceExecArguments = () =>
  process.versions.bun
    ? [
        '--no-env-file',
        '--no-install',
        `--config=${fileURLToPath(new URL('../../../bunfig.toml', import.meta.url))}`,
      ]
    : ['--import', import.meta.resolve('tsx')];
