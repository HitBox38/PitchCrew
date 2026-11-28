import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { packet } from '../../board/test/fixtures/packet.ts';
import { matchingPacketExport, packetExportFiles, writePacket } from '../src/index.ts';

const directories: string[] = [];
afterEach(() =>
  Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))),
);

it('writes resume and cover letter files from the resume heading and still matches an older folder', async () => {
  const files = packetExportFiles(packet, []);
  expect(Object.keys(files)).toEqual([
    'Example_candidate_CV.md',
    'Example_candidate_Cover_Letter.md',
    'form_answers.md',
    'note.md',
    'claims.json',
  ]);
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-export-'));
  directories.push(directory);
  const output = await writePacket(directory, 'card', packet);
  expect(await readdir(output)).toEqual(expect.arrayContaining(['Example_candidate_CV.md']));
  expect(await readFile(join(output, 'Example_candidate_CV.md'), 'utf8')).toBe(packet.resume);
  const legacy = await mkdtemp(join(tmpdir(), 'pitchcrew-legacy-export-'));
  directories.push(legacy);
  await Promise.all(
    Object.entries({
      'resume.md': packet.resume,
      'cover_letter.md': packet.coverLetter,
      'form_answers.md': packet.formAnswers,
      'note.md': packet.note,
      'claims.json': JSON.stringify(packet.claims, null, 2),
    }).map(([name, bytes]) => writeFile(join(legacy, name), bytes)),
  );
  expect(await matchingPacketExport(legacy, files)).toBe(true);
});
