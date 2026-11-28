import type { Packet, PacketArtifact } from '@pitchcrew/core';
import { legacyExportFileName, packetExportFileName } from '@pitchcrew/core/packet-files';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { verifiedArtifact } from './artifacts.ts';
export const packetExportFiles = (packet: Packet, artifacts: PacketArtifact[]) => {
  const files: Record<string, Uint8Array | string> = {
    [packetExportFileName(packet.resume, 'resume.md')]: packet.resume,
    [packetExportFileName(packet.resume, 'cover_letter.md')]: packet.coverLetter,
    'form_answers.md': packet.formAnswers,
    'note.md': packet.note,
    'claims.json': JSON.stringify(packet.claims, null, 2),
  };
  for (const artifact of artifacts) {
    if (!/^(resume|cover_letter)\.(pdf|docx)$/.test(artifact.name))
      throw new Error('Invalid artifact filename.');
    files[packetExportFileName(packet.resume, artifact.name)] = verifiedArtifact(artifact);
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
  const expected = Object.keys(files);
  if (names.length !== expected.length)
    throw new Error('The incomplete export folder changed. Request a fresh export approval.');
  await Promise.all(
    expected.map(async (name) => {
      const legacy = legacyExportFileName(name);
      const onDisk = names.includes(name) ? name : legacy && names.includes(legacy) ? legacy : '';
      if (!onDisk || !(await readFile(join(directory, onDisk))).equals(Buffer.from(files[name]!)))
        throw new Error('The incomplete export files changed. Request a fresh export approval.');
    }),
  );
  return true;
};
