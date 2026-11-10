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
  z
    .object({
      action: z.literal('rename-folder'),
      from: folder.refine((path) => path !== ''),
      to: folder.refine((path) => path !== ''),
    })
    .strict(),
  z
    .object({ action: z.literal('delete-folder'), path: folder.refine((path) => path !== '') })
    .strict(),
]);

const within = (path: string, parent: string) => path === parent || path.startsWith(`${parent}/`);
const addParents = (state: ProfileOrganization, path: string) => {
  const parts = path ? path.split('/') : [];
  for (let depth = 1; depth <= parts.length; depth++) {
    const parent = parts.slice(0, depth).join('/');
    if (!state.folders.includes(parent)) state.folders.push(parent);
  }
};
const renameFolder = (state: ProfileOrganization, from: string, to: string) => {
  if (!state.folders.includes(from)) throw new Error('This folder no longer exists.');
  if (within(to, from)) throw new Error('A folder cannot move inside itself.');
  if (state.folders.includes(to)) throw new Error('A folder with this name already exists here.');
  const renamed = (path: string) => (within(path, from) ? to + path.slice(from.length) : path);
  state.folders = state.folders.map(renamed);
  addParents(state, to);
  for (const [name, location] of Object.entries(state.locations))
    state.locations[name] = renamed(location);
};

/** Explorer-only metadata: organizing notes cannot change agent evidence or source links. */
export class ProfileOrganizationStore {
  private readonly path: string;
  private readonly notes: string;
  private state: ProfileOrganization = { version: 1, folders: [], locations: {} };

  constructor(directory: string) {
    this.path = join(directory, 'profile-organization.json');
    this.notes = join(directory, 'profile');
    if (existsSync(this.path))
      this.state = stateSchema.parse(JSON.parse(readFileSync(this.path, 'utf8')));
  }

  get = (): ProfileOrganization => {
    return structuredClone(this.state);
  };

  change = (input: unknown): ProfileOrganization => {
    const command = commandSchema.parse(input);
    const next = this.get();
    if (command.action === 'rename-folder') renameFolder(next, command.from, command.to);
    else if (command.action === 'delete-folder') this.deleteFolder(next, command.path);
    else {
      const path = command.action === 'create' ? command.path : command.folder;
      if (command.action === 'create' && next.folders.includes(path))
        throw new Error('A folder with this name already exists here.');
      addParents(next, path);
      if (command.action === 'move') next.locations[command.name] = command.folder;
    }
    return this.commit(next);
  };

  /** Keep a renamed note in its explicit folder; notes without one keep their default place. */
  renameNote = (from: string, to: string): ProfileOrganization => {
    const next = this.get();
    if (!(from in next.locations)) return next;
    next.locations[to] = next.locations[from];
    delete next.locations[from];
    return this.commit(next);
  };

  /** Set or clear one note's explicit folder, creating missing parent folders like `move`. */
  placeNote = (name: string, location: string | undefined): ProfileOrganization => {
    const next = this.get();
    if (location === undefined) {
      if (!(name in next.locations)) return next;
      delete next.locations[name];
    } else {
      addParents(next, folder.parse(location));
      next.locations[noteName.parse(name)] = location;
    }
    return this.commit(next);
  };

  private deleteFolder = (state: ProfileOrganization, path: string) => {
    if (!state.folders.includes(path)) throw new Error('This folder no longer exists.');
    // Locations of notes that no longer exist on disk are stale and never block deletion.
    const placed = Object.entries(state.locations).filter(([, location]) => within(location, path));
    if (placed.some(([name]) => existsSync(join(this.notes, name))))
      throw new Error('Move or delete the notes in this folder first.');
    for (const [name] of placed) delete state.locations[name];
    state.folders = state.folders.filter((candidate) => !within(candidate, path));
  };

  private commit = (next: ProfileOrganization): ProfileOrganization => {
    const state = stateSchema.parse(next);
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(state)}\n`, { mode: 0o600 });
    renameSync(temporary, this.path);
    this.state = state;
    return this.get();
  };
}
