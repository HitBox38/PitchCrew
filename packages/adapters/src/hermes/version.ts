import { stripVTControlCharacters } from 'node:util';

/** Hermes prints installation paths and dependency versions after its own version line. */
export const hermesVersion = (stdout: string): string =>
  stripVTControlCharacters(stdout).match(
    /^\s*Hermes(?:\s+Agent)?\s+v?(\d+\.\d+\.\d+(?:[-+][\w.-]+)?)(?=\s|$)/im,
  )?.[1] ?? '';
