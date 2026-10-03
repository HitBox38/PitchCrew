import type { Packet, PacketArtifact, ProfileFile } from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { verifiedArtifact } from './artifacts.ts';
export * from './artifacts.ts';
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
export function lintPacket(packet: Packet, profile: ProfileFile[]) {
  const problems: string[] = [];
  for (const claim of packet.claims) {
    const source = profile.find((file) => file.name === claim.source);
    if (!source || !source.content.includes(claim.quote))
      problems.push(`Source does not support: ${claim.claim}`);
    if (claim.claim !== claim.quote)
      problems.push(`Use an exact source quotation for the claim: ${claim.claim}`);
    if (
      ![packet.resume, packet.coverLetter, packet.formAnswers, packet.note].some((text) =>
        text.includes(claim.claim),
      )
    )
      problems.push(`Claim is not included in the packet: ${claim.claim}`);
  }
  if (packet.resume.split(/\s+/).length > 650) problems.push('Resume exceeds 650 words.');
  if (packet.coverLetter.split(/\s+/).length > 500)
    problems.push('Cover letter exceeds 500 words.');
  return problems;
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
