import { createRequire } from 'node:module';

// Node receives the executable path; Electron's declarations describe its in-process API.
export const electronExecutable = createRequire(import.meta.url)('electron') as string;
