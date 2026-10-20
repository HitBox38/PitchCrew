import { useState, type FormEvent } from 'react';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { ProfileFile, ProfileSourceInput } from '@pitchcrew/core';
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

export const useProfileSources = (props: ProfileSourcesProps, open: boolean) => {
  const back = () => {
    setup.setAdding(false);
    setProposalId(null);
    task.setError('');
  };
  const complete = (result: SourceNotice) => {
    setNotice(result);
    setPreview(null);
    back();
  };
  const load = async (input: ProfileSourceInput, sourceId?: string) => {
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
  };
  const previewSource = (event: FormEvent) => {
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
      });
    } catch (error) {
      task.setError(error instanceof Error ? error.message : 'Check your source link.');
    }
  };
  const importSelected = async () => {
    if (!preview || busy || !selected.length) return;
    await task.perform('Importing documents…', async () => {
      const files = await importSourceDocuments(props.action, preview.token, selected);
      complete({
        message: 'Profile notes imported.',
        file: files.find((f) => selected.includes(f.name)),
      });
    });
  };
  const watch = async (id: string, watching: boolean) => {
    if (busy) return;
    await task.perform(
      watching ? 'Enabling watching…' : 'Pausing watching…',
      async () => {
        await setSourceWatching(props.action, id, watching);
        setNotice({ message: watching ? 'Source watching enabled.' : 'Source watching paused.' });
      },
      id,
    );
  };
  const unlink = async (id: string) => {
    if (busy) return;
    await task.perform(
      'Removing source…',
      async () => {
        await removeSource(props.action, id);
        setNotice({ message: 'Source removed. Local notes were kept.' });
        setReturnFocus('add');
      },
      id,
    );
  };
  const startAdd = (provider?: SourceProvider) => {
    setReturnFocus('add');
    setNotice(null);
    task.setError('');
    setup.startAdd(provider);
  };
  const reviewProposal = (id: string) => {
    setReturnFocus(`review-${id}`);
    setNotice(null);
    task.setError('');
    setProposalId(id);
  };
  const reviewed = (file: ProfileFile | undefined, approved: boolean) => {
    complete({
      message: approved
        ? file
          ? 'Verified profile updates applied.'
          : 'Source changes acknowledged.'
        : 'Profile updates rejected.',
      file,
    });
    void list.refresh();
  };

  const connection = useConnectorSettings(props);
  const list = useSourceList(open);
  const task = useSourceTask();
  const setup = useSourceSetup();
  const { preview, selected, notice } = useWorkspaceStore((state) => state.profileSources);
  const update = useWorkspaceStore((state) => state.updateProfileSources);
  const setPreview = (value: typeof preview) => update({ preview: value });
  const setSelected = (value: string[] | ((current: string[]) => string[])) =>
    update((state) => ({ selected: typeof value === 'function' ? value(state.selected) : value }));
  const setNotice = (notice: SourceNotice | null) => update({ notice });
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
  return {
    ...setup,
    ...list,
    ...task,
    busy,
    canRead,
    connection,
    preview,
    setPreview,
    closeReview: () => (task.progress ? update({ open: false }) : setPreview(null)),
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
    proposalPending,
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
};
