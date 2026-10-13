import type { ProfileOrganization } from '@pitchcrew/core';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const folder = z
  .string()
  .max(500)
  .refine(
    (path) =>
      path === '' ||
      (path.split('/').length <= 12 &&
        path
          .split('/')
          .every(
            (part) =>
              part.length > 0 &&
              part.length <= 80 &&
              part.trim() === part &&
              part !== '.' &&
              part !== '..' &&
              ![...part].some(
                (character) =>
                  character === '\\' ||
                  character.codePointAt(0)! < 32 ||
                  character.codePointAt(0) === 127,
              ),
          )),
    'Use folder names without slashes, backslashes or parent-directory segments.',
  );
const noteName = z
  .string()
  .max(100)
  .regex(/^[\w.-]+\.md$/)
  .refine((name) => !name.includes('..'));
const stateSchema = z
  .object({
    version: z.literal(1),
    folders: z.array(folder.refine((path) => path !== '')).max(200),
    locations: z
      .record(noteName, folder)
      .refine((locations) => Object.keys(locations).length <= 2000),
  })
  .strict();
const commandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), path: folder.refine((path) => path !== '') }).strict(),
  z.object({ action: z.literal('move'), name: noteName, folder }).strict(),
]);

/** Explorer-only metadata: organizing notes cannot change agent evidence or source links. */
export class ProfileOrganizationStore {
  private readonly path: string;
  private state: ProfileOrganization = { version: 1, folders: [], locations: {} };

  constructor(directory: string) {
    this.path = join(directory, 'profile-organization.json');
    if (existsSync(this.path))
      this.state = stateSchema.parse(JSON.parse(readFileSync(this.path, 'utf8')));
  }

  get(): ProfileOrganization {
    return structuredClone(this.state);
  }

  change(input: unknown): ProfileOrganization {
    const command = commandSchema.parse(input);
    const next = this.get();
    const path = command.action === 'create' ? command.path : command.folder;
    if (command.action === 'create' && next.folders.includes(path))
      throw new Error('A folder with this name already exists here.');
    const parts = path ? path.split('/') : [];
    for (let depth = 1; depth <= parts.length; depth++) {
      const parent = parts.slice(0, depth).join('/');
      if (!next.folders.includes(parent)) next.folders.push(parent);
    }
    if (command.action === 'move') next.locations[command.name] = command.folder;
    const state = stateSchema.parse(next);
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(state)}\n`, { mode: 0o600 });
    renameSync(temporary, this.path);
    this.state = state;
    return this.get();
  }
}
