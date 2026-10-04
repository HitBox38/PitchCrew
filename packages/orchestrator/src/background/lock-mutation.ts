import Database from 'better-sqlite3';
import { join } from 'node:path';

/**
 * SQLite's process locks serialize stale-lock reclamation and release. The separate, empty
 * database never opens the board, and its locks are released by the OS if a daemon crashes.
 */
export async function withLockMutation<T>(directory: string, action: () => Promise<T>): Promise<T> {
  const database = new Database(join(directory, 'daemon-lock.sqlite'), { timeout: 0 });
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        database.exec('BEGIN IMMEDIATE');
        break;
      } catch (error) {
        if ((error as { code?: string }).code !== 'SQLITE_BUSY' || attempt >= 500) throw error;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    return await action();
  } finally {
    if (database.inTransaction) database.exec('ROLLBACK');
    database.close();
  }
}
