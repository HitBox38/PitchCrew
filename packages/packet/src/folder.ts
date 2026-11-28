import { readdir, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';

const cardIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const missing = (error: unknown) =>
  (error as NodeJS.ErrnoException).code === 'ENOENT' ||
  (error as NodeJS.ErrnoException).code === 'ENOTDIR';

/** True when `target` is a directory strictly inside `root`, after both are resolved. */
const inside = (root: string, target: string) => {
  const fromRoot = relative(root, target);
  return fromRoot.length > 0 && !fromRoot.startsWith('..') && !isAbsolute(fromRoot);
};

const hasFiles = async (folder: string, depth: number): Promise<boolean> => {
  if (depth > 3) return false;
  let entries;
  try {
    entries = await readdir(folder, { withFileTypes: true });
  } catch (error) {
    if (missing(error)) return false;
    throw error;
  }
  for (const entry of entries) {
    // Dot directories are unfinished export staging and must not count as saved files.
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
    if (entry.isFile()) return true;
    if (entry.isDirectory() && (await hasFiles(join(folder, entry.name), depth + 1))) return true;
  }
  return false;
};

/**
 * The job's packet directory when it stays inside the data folder and contains a saved file.
 * A missing, empty, unfinished, or escaped directory returns null.
 */
export const savedPacketFolder = async (
  directory: string,
  cardId: string,
): Promise<string | null> => {
  if (!cardIdPattern.test(cardId)) return null;
  const packets = join(directory, 'packets');
  let root: string;
  try {
    root = await realpath(packets);
  } catch (error) {
    if (missing(error)) return null;
    throw error;
  }
  let resolved: string;
  try {
    resolved = await realpath(join(root, cardId));
  } catch (error) {
    if (missing(error)) return null;
    throw error;
  }
  if (!inside(root, resolved)) return null;
  return (await hasFiles(resolved, 0)) ? resolved : null;
};
