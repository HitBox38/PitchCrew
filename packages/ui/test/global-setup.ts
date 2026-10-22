import type { TestProject } from 'vitest/node';
import { fileURLToPath } from 'node:url';

const buildUi = async () => {
  const { build } = await import('vite');
  const nodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    await build({
      root: fileURLToPath(new URL('..', import.meta.url)),
      logLevel: 'warn',
    });
  } finally {
    if (nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
  }
};

export default async (project: TestProject) => {
  await buildUi();
  project.onTestsRerun(buildUi);
};
