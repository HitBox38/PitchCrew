import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib';

// Minimal ZIP reading and writing for DOCX packages. Writing uses fixed timestamps and the given
// entry order so identical documents produce identical bytes.
export interface ZipEntry {
  name: string;
  data: Buffer;
}

const endSignature = 0x06054b50;
const centralSignature = 0x02014b50;
const localSignature = 0x04034b50;
// 1980-01-01 00:00, the earliest DOS timestamp.
const dosDate = 0x21;

export function readZip(bytes: Buffer): ZipEntry[] {
  let end = bytes.length - 22;
  while (end >= 0 && bytes.readUInt32LE(end) !== endSignature) end--;
  if (end < 0) throw new Error('Invalid DOCX archive.');
  const count = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16);
  const entries: ZipEntry[] = [];
  for (let index = 0; index < count; index++) {
    if (bytes.readUInt32LE(offset) !== centralSignature) throw new Error('Invalid DOCX archive.');
    const method = bytes.readUInt16LE(offset + 10);
    const size = bytes.readUInt32LE(offset + 20);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const local = bytes.readUInt32LE(offset + 42);
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    if (bytes.readUInt32LE(local) !== localSignature) throw new Error('Invalid DOCX archive.');
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    const stored = bytes.subarray(start, start + size);
    if (method !== 0 && method !== 8) throw new Error('Unsupported DOCX compression.');
    entries.push({ name, data: method === 8 ? inflateRawSync(stored) : Buffer.from(stored) });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export function writeZip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const compressed = deflateRawSync(entry.data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(localSignature, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(dosDate, 12);
    header.writeUInt32LE(crc32(entry.data), 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(entry.data.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(centralSignature, 0);
    central.writeUInt16LE(20, 4);
    header.copy(central, 6, 4, 30);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    locals.push(header, name, compressed);
    centrals.push(central, name);
    offset += header.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(endSignature, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
