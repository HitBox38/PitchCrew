import type { Packet, PacketArtifact } from '@pitchcrew/core';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { verifiedArtifact } from './artifacts.ts';
export const packetExportFiles = (packet: Packet, artifacts: PacketArtifact[]) => {
  const files: Record<string, Uint8Array | string> = {
    'resume.md': packet.resume,
    'cover_letter.md': packet.coverLetter,
    'form_answers.md': packet.formAnswers,
    'note.md': packet.note,
    'claims.json': JSON.stringify(packet.claims, null, 2),
  };
  for (const artifact of artifacts) {
    if (!/^(resume|cover_letter)\.(pdf|docx)$/.test(artifact.name))
      throw new Error('Invalid artifact filename.');
    files[artifact.name] = verifiedArtifact(artifact);
  }
  return files;
};
export const matchingPacketExport = async (
  directory: string,
  files: Record<string, Uint8Array | string>,
) => {
  let names: string[];
  try {
    names = await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
  if (names.length !== Object.keys(files).length)
    throw new Error('The incomplete export folder changed. Request a fresh export approval.');
  await Promise.all(
    Object.entries(files).map(async ([name, bytes]) => {
      if (
        !names.includes(name) ||
        !(await readFile(join(directory, name))).equals(Buffer.from(bytes))
      )
        throw new Error('The incomplete export files changed. Request a fresh export approval.');
    }),
  );
  return true;
};
