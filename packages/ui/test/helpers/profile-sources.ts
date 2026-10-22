import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';
import type {
  ProfileMaintenanceProposal,
  ProfileSource,
  ProfileSourcePreview,
  Snapshot,
} from '@pitchcrew/core';
import type { setup } from './daemon.ts';
import { digest } from '../../../orchestrator/src/profile-sources/helpers.ts';
import { proposalDigest } from '../../../orchestrator/src/crew/gateway/profile-project.ts';
export const sourceFixture = (host: Host) => {
  const remote = { content: '# Background\n\nBuilt a fictional scheduling tool.', fail: false };
  vi.spyOn(host.daemon.service.connectors, 'status').mockReturnValue([
    {
      id: 'github',
      account: 'fictional',
      connected: true,
      services: ['github'],
      configured: true,
      pending: false,
      error: '',
    },
    {
      id: 'google',
      account: 'fictional@example.com',
      connected: true,
      services: ['drive'],
      configured: true,
      pending: false,
      error: '',
    },
  ]);
  vi.spyOn(host.daemon.service.connectors, 'call').mockImplementation(async (name, raw) => {
    if (remote.fail) throw new Error('Fictional source is temporarily unavailable.');
    if (name === 'github_get_revision') return { sha: 'a'.repeat(40) };
    if (name === 'github_read_file') {
      const input = raw as { path: string };
      return input.path === 'about-me'
        ? { entries: [{ path: 'about-me/background.md', type: 'file' }] }
        : { text: remote.content, sha: 'b'.repeat(40) };
    }
    if (name === 'google_drive_get_file')
      return {
        data:
          (raw as { fileId: string }).fileId === 'fictional-folder'
            ? { name: 'Work history', mimeType: 'application/vnd.google-apps.folder' }
            : { modifiedTime: '2026-10-10T00:00:00Z' },
      };
    if (name === 'google_drive_search_files')
      return {
        data: {
          files: [
            {
              id: 'fictional-doc',
              name: 'Background',
              mimeType: 'application/vnd.google-apps.document',
              modifiedTime: '2026-10-10T00:00:00Z',
            },
          ],
        },
      };
    if (name === 'google_docs_get_document') return { data: { text: remote.content } };
    throw new Error(`Unexpected fictional connector call: ${name}`);
  });
  return remote;
};
export const importSource = async (host: Host) => {
  const { result: preview } = await host.request<ProfileSourcePreview>(
    '/profile/sources/preview',
    'POST',
    sourceInput,
  );
  await host.request('/profile/sources/import', 'POST', {
    token: preview.token,
    names: preview.files.map((f) => f.name),
  });
  const { result: sources } = await host.request<ProfileSource[]>('/profile/sources');
  await host.request(`/profile/sources/${sources[0].id}/watch`, 'PUT', { watching: true });
  return preview;
};
export const createProposal = async (host: Host, applying = false) => {
  const { result: sources } = await host.request<ProfileSource[]>('/profile/sources');
  const { result: preview } = await host.request<ProfileSourcePreview>(
    '/profile/sources/preview',
    'POST',
    sourceInput,
  );
  const { result: snapshot } = await host.request<Snapshot>('/snapshot');
  const documents = preview.files
    .filter((file) => file.status !== 'unchanged')
    .map((file) => ({
      ...file,
      before: snapshot.profile.find((note) => note.name === file.name)?.content ?? null,
    }));
  const proposal: ProfileMaintenanceProposal = {
    id: randomUUID(),
    roleId: 'documenter',
    runId: 'fictional-profile-run',
    source: preview.source,
    baseSources: sources,
    baseProfile: snapshot.profile.map((file) => ({
      name: file.name,
      digest: digest(file.content),
    })),
    documents,
    missing: preview.missing,
    snapshotDigest: '',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  proposal.snapshotDigest = proposalDigest(proposal);
  if (applying)
    Object.assign(proposal, {
      status: 'applying',
      selected: documents.map((f) => f.name),
      verifiedFacts: true,
    });
  host.daemon.service.board.record(
    'profile_proposal',
    proposal,
    'documenter',
    'Fictional proposal',
  );
  return proposal;
};

type Host = Awaited<ReturnType<typeof setup>>;
export const sourceInput = {
  provider: 'github',
  repository: 'fictional/profile',
  path: 'about-me',
};
