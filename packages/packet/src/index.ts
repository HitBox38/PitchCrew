import type { Packet, PacketArtifact, ProfileFile } from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { verifiedArtifact } from './artifacts.ts';
export * from './artifacts.ts';
export * from './rules.ts';
import { join } from 'node:path';

export async function readProfile(directory: string): Promise<ProfileFile[]> {
  const path = join(directory, 'profile');
  await mkdir(path, { recursive: true });
  const files = await readdir(path);
  return Promise.all(
    files
      .filter((name) => /^[\w.-]+\.md$/.test(name))
      .map(async (name) => ({ name, content: await readFile(join(path, name), 'utf8') })),
  );
}
export async function writePacket(
  directory: string,
  cardId: string,
  packet: Packet,
  artifacts: PacketArtifact[] = [],
) {
  const parent = join(directory, 'packets', cardId);
  await mkdir(parent, { recursive: true });
  const version = `try-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const staging = join(parent, `.${version}`);
  await mkdir(staging);
  await Promise.all(
    Object.entries({
      'resume.md': packet.resume,
      'cover_letter.md': packet.coverLetter,
      'form_answers.md': packet.formAnswers,
      'note.md': packet.note,
      'claims.json': JSON.stringify(packet.claims, null, 2),
    }).map(([name, text]) => writeFile(join(staging, name), text, 'utf8')),
  );
  await Promise.all(
    artifacts.map((artifact) => {
      if (!/^(resume|cover_letter)\.(pdf|docx)$/.test(artifact.name))
        throw new Error('Invalid artifact filename.');
      return writeFile(join(staging, artifact.name), verifiedArtifact(artifact));
    }),
  );
  const output = join(parent, version);
  await rename(staging, output);
  return output;
}
