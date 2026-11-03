import { beforeEach, expect, it, vi } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import type { Role, Skill } from '@pitchcrew/core';
import type { CrewContext } from '../src/crew/types.ts';
import { writeRunInstructions } from '../src/crew/roles.ts';

vi.mock('node:fs/promises', async (original) => ({
  ...(await original<typeof import('node:fs/promises')>()),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(mkdir).mockResolvedValue(undefined);
  vi.mocked(writeFile).mockReset();
});
it('prepares independent skill and instruction files together and awaits every write', async () => {
  const completions: (() => void)[] = [];
  vi.mocked(writeFile).mockImplementation(
    () => new Promise<void>((resolve) => completions.push(resolve)),
  );
  const role = { instructions: 'Fictional instructions' } as Role;
  const skills = ['first', 'second', 'third'].map(
    (id) => ({ id, name: id, description: `Use ${id}`, content: `# ${id}` }) as Skill,
  );
  let finished = false;
  const writing = writeRunInstructions({} as CrewContext, '/fictional/run', role, skills).then(
    () => {
      finished = true;
    },
  );
  await vi.waitFor(() => expect(writeFile).toHaveBeenCalledTimes(5), { timeout: 200 });
  expect(finished).toBe(false);
  expect(writeFile).toHaveBeenCalledWith('/fictional/run/CLAUDE.md', '@AGENTS.md\n', 'utf8');
  for (const done of completions.slice(1)) done();
  await Promise.resolve();
  expect(finished).toBe(false);
  completions[0]!();
  await writing;
  expect(finished).toBe(true);
});

it('settles the other writes before reporting a failure so retries cannot race them', async () => {
  let release!: () => void;
  const otherWrite = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.mocked(writeFile)
    .mockRejectedValueOnce(new Error('Fixture write failure'))
    .mockReturnValueOnce(otherWrite);
  let finished = false;
  const result = writeRunInstructions(
    {} as CrewContext,
    '/fictional/run',
    { instructions: 'Fixture' } as Role,
    [],
  ).catch((error: Error) => {
    finished = true;
    return error.message;
  });
  await vi.waitFor(() => expect(writeFile).toHaveBeenCalledTimes(2));
  expect(finished).toBe(false);
  release();
  expect(await result).toBe('Fixture write failure');
});
