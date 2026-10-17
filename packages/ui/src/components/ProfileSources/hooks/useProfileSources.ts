import { useState, type FormEvent } from 'react';
import type { ProfileFile, ProfileSourceInput, ProfileSourcePreview } from '@pitchcrew/core';
import {
  addProjectWatch,
  importSourceDocuments,
  readSourceDocuments,
  removeSource,
  setSourceWatching,
} from '../api.ts';
import { useConnectorSettings } from '@/ConnectorSettings/hooks/useConnectorSettings.ts';
import { driveInput, githubInput } from '../helpers.ts';
import type { ProfileSourcesProps, SourceNotice, SourceProvider } from '../types.ts';
import { useSourceList } from './useSourceList.ts';
import { useSourceTask } from './useSourceTask.ts';
import { useSourceSetup } from './useSourceSetup.ts';

export function useProfileSources(props: ProfileSourcesProps, open: boolean) {
  const connection = useConnectorSettings(props);
  const list = useSourceList(open);
  const task = useSourceTask();
  const setup = useSourceSetup();
  const [preview, setPreview] = useState<ProfileSourcePreview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState<SourceNotice | null>(null);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [proposalPending, setProposalPending] = useState(false);
  const [returnFocus, setReturnFocus] = useState('add');
  const proposals = (props.data.profileProposals ?? []).filter((p) =>
    ['pending', 'applying'].includes(p.status),
  );
  const proposal = proposals.find((p) => p.id === proposalId);
  const busy = props.working || !!task.progress || list.loading || proposalPending;
  const connected = props.data.connectors.find(
    (account) => account.id === (setup.provider === 'github' ? 'github' : 'google'),
  );
  const canRead = !!(
    connected?.connected &&
    (setup.provider === 'github' || connected.services.includes('drive'))
  );
  function back() {
    setup.setAdding(false);
    setProposalId(null);
    task.setError('');
  }
  function complete(result: SourceNotice) {
    setNotice(result);
    setPreview(null);
    back();
  }
  async function load(input: ProfileSourceInput, sourceId?: string) {
    if (busy) return;
    await task.perform(
      input.provider === 'github' ? 'Reading GitHub documents…' : 'Reading Google Drive documents…',
      async () => {
        const result = await readSourceDocuments(input);
        setPreview(result);
        setSelected(
          result.files.filter((f) => ['new', 'changed'].includes(f.status)).map((f) => f.name),
        );
      },
      sourceId,
    );
  }
  function previewSource(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    try {
      const input =
        setup.provider === 'github'
          ? githubInput(setup.repository, setup.path, setup.branch)
          : driveInput(setup.folder);
      if (setup.intent !== 'project') {
        void load(input);
        return;
      }
      void task.perform('Checking project…', async () => {
        await addProjectWatch(props.action, input);
        complete({ message: 'Project watch added. An authorized agent can check for changes.' });
        await list.refresh();
      });
    } catch (error) {
      task.setError(error instanceof Error ? error.message : 'Check your source link.');
    }
  }
  async function importSelected() {
    if (!preview || busy || !selected.length) return;
    await task.perform('Importing documents…', async () => {
      const files = await importSourceDocuments(props.action, preview.token, selected);
      complete({
        message: 'Profile notes imported.',
        file: files.find((f) => selected.includes(f.name)),
      });
      await list.refresh();
    });
  }
  async function watch(id: string, watching: boolean) {
    if (busy) return;
    await task.perform(
      watching ? 'Enabling watching…' : 'Pausing watching…',
      async () => {
        await setSourceWatching(props.action, id, watching);
        await list.refresh();
      },
      id,
    );
  }
  async function unlink(id: string) {
    if (busy) return;
    await task.perform(
      'Removing source…',
      async () => {
        await removeSource(props.action, id);
        setNotice({ message: 'Source removed. Local notes were kept.' });
        setReturnFocus('add');
        await list.refresh();
      },
      id,
    );
  }
  function startAdd(provider?: SourceProvider) {
    setReturnFocus('add');
    setNotice(null);
    task.setError('');
    setup.startAdd(provider);
  }
  function reviewProposal(id: string) {
    setReturnFocus(`review-${id}`);
    setNotice(null);
    task.setError('');
    setProposalId(id);
  }
  function reviewed(file: ProfileFile | undefined, approved: boolean) {
    complete({
      message: approved
        ? file
          ? 'Verified profile updates applied.'
          : 'Source changes acknowledged.'
        : 'Profile updates rejected.',
      file,
    });
    void list.refresh();
  }
  return {
    ...setup,
    ...list,
    ...task,
    busy,
    canRead,
    connection,
    preview,
    setPreview,
    selected,
    setSelected,
    notice,
    proposals,
    proposal,
    proposalId,
    returnFocus,
    startAdd,
    back,
    reviewProposal,
    previewSource,
    load,
    watch,
    unlink,
    maintenance: props,
    reviewed,
    setProposalPending,
    pending: !!task.progress || proposalPending,
    screen: proposalId
      ? `proposal-${proposalId}`
      : setup.adding
        ? `add-${setup.provider ?? ''}-${setup.intent ?? ''}`
        : 'list',
    toggle: (name: string) =>
      setSelected((current) =>
        current.includes(name) ? current.filter((value) => value !== name) : [...current, name],
      ),
    importSelected: () => props.requestImport(() => void importSelected()),
    openNotice: () => {
      const file = notice?.file;
      if (file)
        props.requestImport(() =>
          props.openImported(props.data.profile.find((note) => note.name === file.name) ?? file),
        );
    },
  };
}
