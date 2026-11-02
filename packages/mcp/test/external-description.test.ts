import { expect, it } from 'vitest';
import { externalTools } from '../src/external/tools.ts';

it('rejects raw browser syntax in external job creation without changing readable descriptions', () => {
  const input = { company: 'Northwind Labs', title: 'Engineer' };
  expect(() =>
    externalTools.create_job.schema.parse({
      ...input,
      description: '- heading "The role" [level=2]\n- paragraph: Build UI.',
    }),
  ).toThrow('browser accessibility/extraction syntax');
  const description = 'The role\n\nBuild UI.\n\n- React\n- TypeScript\n\nFinal paragraph.';
  expect(externalTools.create_job.schema.parse({ ...input, description }).description).toBe(
    description,
  );
  expect(
    externalTools.create_job.schema.parse({ url: 'https://example.com/job' }).description,
  ).toBe('');
});
