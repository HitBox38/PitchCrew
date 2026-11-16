import type { ProfileSource } from '@pitchcrew/core';
import { z } from 'zod';
import { contentDigest } from '../../profile-notes/helpers.ts';
import type { CrewContext } from '../types.ts';
import type { authorizeProfileEdit } from './profile-edit.ts';

interface Edit {
  action: 'save' | 'delete';
  name: string;
  baseline: string | null;
  content?: string;
  sourceId?: string;
  path?: string;
}

const remotePath = z
  .string()
  .max(500)
  .refine(
    (path) =>
      /\.(md|txt)$/i.test(path) &&
      !path.includes('\\') &&
      !path
        .split('/')
        .some(
          (part) =>
            !part ||
            part === '.' ||
            part === '..' ||
            /^(\.git|\.github|\.agents|\.claude|\.cursor|node_modules|resumes|data|tools)$/i.test(
              part,
            ),
        ) &&
      !/(^|\/)(AGENTS|CLAUDE|SKILL)\.md$/i.test(path),
    'Choose a profile document path inside the connected source folder.',
  );

export const profileEditTarget = (sources: ProfileSource[], edit: Edit) => {
  const attached = sources.filter((source) => source.files.some((file) => file.name === edit.name));
  if (attached.length > 1)
    throw new Error('This note has ambiguous source connections. Resolve them on Profile.');
  let source: ProfileSource | undefined = attached[0];
  if (edit.sourceId) {
    if (source && source.id !== edit.sourceId)
      throw new Error('Keep this note attached to its saved source.');
    source = sources.find((item) => item.id === edit.sourceId);
    if (!source) throw new Error('Profile source not found.');
  }
  if (!source && edit.action === 'save' && edit.baseline === null) {
    const github = sources.filter((item) => !item.mode && item.input.provider === 'github');
    if (github.length > 1)
      throw new Error(
        'Choose sourceId for the new note; several GitHub profile sources are connected.',
      );
    source = github[0];
  }
  if (!source) {
    if (edit.path) throw new Error('Choose a connected profile source for this path.');
    return null;
  }
  if (source.mode) throw new Error('Project watches cannot receive profile writes.');
  const file = source.files.find((item) => item.name === edit.name);
  if (source.input.provider !== 'github') {
    if (edit.path) throw new Error('Only GitHub profile sources support write-back paths.');
    return { source, file, path: file?.path ?? edit.name };
  }
  if (file && edit.path && file.path !== edit.path)
    throw new Error('Use this note’s saved GitHub path.');
  const path = remotePath.parse(
    file?.path ?? edit.path ?? [source.input.path, edit.name].filter(Boolean).join('/'),
  );
  if (source.input.path && !path.startsWith(source.input.path + '/'))
    throw new Error('Choose a document inside the connected profile source folder.');
  if (!file && source.files.some((item) => item.path === path))
    throw new Error('This GitHub path already belongs to another profile note.');
  if (!file && source.files.length >= 100)
    throw new Error('Keep at most 100 documents per profile source.');
  return { source, file, path };
};

export const syncProfileEdit = async (
  context: CrewContext,
  target: NonNullable<ReturnType<typeof profileEditTarget>>,
  edit: Edit,
  authorize: () => ReturnType<typeof authorizeProfileEdit>,
) => {
  const { source, file, path } = target;
  if (source.input.provider !== 'github')
    return { status: 'local_only', reason: 'This source does not support GitHub sync.' };
  try {
    const check = async () => {
      authorize();
      if (
        !context.connectors.status().some((account) => account.id === 'github' && account.connected)
      )
        throw new Error('Connect GitHub in Settings to sync the profile source.');
    };
    await check();
    const result = await context.connectors.writeProfileGithub(
      {
        repository: source.input.repository,
        branch: source.input.ref,
        path,
        content: edit.action === 'delete' ? null : edit.content!,
        expectedSha: file?.revision ?? null,
        message: `Profile: ${edit.action === 'delete' ? 'remove' : 'update'} ${path}`,
      },
      authorize().signal,
      check,
    );
    await context.profileSources.recordWrite(
      source.id,
      edit.name,
      edit.action === 'delete'
        ? null
        : {
            key: path,
            name: edit.name,
            path,
            url: result.url,
            revision: result.sha!,
            digest: contentDigest(edit.content!),
          },
    );
    return { status: 'synced', commit: result.commit, branch: result.branch, url: result.url };
  } catch (error) {
    return {
      status: 'unsynced',
      error: error instanceof Error ? error.message : 'GitHub sync failed.',
      recovery:
        'The local change is saved. Inspect GitHub and refresh the source before retrying; do not automatically repeat a commit.',
    };
  }
};
