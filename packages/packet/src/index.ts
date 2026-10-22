import type { Packet, PacketArtifact, ProfileFile } from '@pitchcrew/core';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { packetExportFiles, matchingPacketExport } from './export-files.ts';

export const readProfile = async (directory: string): Promise<ProfileFile[]> => {
  const path = join(directory, 'profile');
  await mkdir(path, { recursive: true });
  const files = await readdir(path);
  return Promise.all(
    files
      .filter((name) => /^[\w.-]+\.md$/.test(name))
      .map(async (name) => ({ name, content: await readFile(join(path, name), 'utf8') })),
  );
};
export const writePacket = async (
  directory: string,
  cardId: string,
  packet: Packet,
  artifacts: PacketArtifact[] = [],
  exportId?: string,
) => {
  const parent = join(directory, 'packets', cardId);
  await mkdir(parent, { recursive: true });
  const version = exportId
    ? `try-export-${createHash('sha256').update(exportId).digest('hex')}`
    : `try-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const files = packetExportFiles(packet, artifacts);
  const output = join(parent, version);
  if (exportId && (await matchingPacketExport(output, files))) return output;
  const staging = join(parent, `.${version}`);
  await mkdir(staging, { recursive: true });
  await Promise.all(
    Object.entries(files).map(([name, bytes]) => writeFile(join(staging, name), bytes)),
  );
  await rename(staging, output);
  return output;
};

export * from './artifacts.ts';
export * from './rules.ts';
export * from './verification/index.ts';
export { matchingPacketExport, packetExportFiles } from './export-files.ts';
import { join } from 'node:path';
