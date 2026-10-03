import { api } from '@/api.ts';
import { useConnectorSettings } from '@/ConnectorSettings/hooks/useConnectorSettings.ts';
import type {
  ProfileFile,
  ProfileSource,
  ProfileSourceInput,
  ProfileSourcePreview,
} from '@pitchcrew/core';
import { useEffect, useState, type FormEvent } from 'react';
import { driveInput, githubInput } from '../helpers.ts';
import type { ProfileSourcesProps } from '../types.ts';

export function useProfileSources(props: ProfileSourcesProps) {
  const { action, working, requestImport, openImported } = props;
  const connection = useConnectorSettings(props);
  const [sources, setSources] = useState<ProfileSource[]>([]);
  const [provider, setProvider] = useState<'github' | 'drive' | null>(null);
  const [repository, setRepository] = useState('');
  const [path, setPath] = useState('about-me');
  const [branch, setBranch] = useState('');
  const [folder, setFolder] = useState('');
  const [preview, setPreview] = useState<ProfileSourcePreview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void api<ProfileSource[]>('/profile/sources', 'GET', undefined, controller.signal)
      .then(setSources)
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : 'Could not load profile sources.');
      });
    return () => controller.abort();
  }, []);
  const busy = working || pending;
  const connected = props.data.connectors.find(
    (account) => account.id === (provider === 'github' ? 'github' : 'google'),
  );
  const canRead =
    connected?.connected && (provider === 'github' || connected.services.includes('drive'));
  async function load(input: ProfileSourceInput) {
    setPending(true);
    setError('');
    try {
      const result = await api<ProfileSourcePreview>('/profile/sources/preview', 'POST', input);
      setPreview(result);
      setSelected(
        result.files
          .filter((file) => file.status === 'new' || file.status === 'changed')
          .map((file) => file.name),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read profile source.');
    } finally {
      setPending(false);
    }
  }
  function previewSource(event: FormEvent) {
    event.preventDefault();
    try {
      void load(provider === 'github' ? githubInput(repository, path, branch) : driveInput(folder));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Check your source link.');
    }
  }
  async function importSelected() {
    if (!preview || busy || !selected.length) return;
    setPending(true);
    setError('');
    try {
      const files = (await action(
        '/profile/sources/import',
        'POST',
        { token: preview.token, names: selected },
        'Profile documents imported',
      )) as ProfileFile[];
      setSources(await api<ProfileSource[]>('/profile/sources'));
      const first = files.find((file) => selected.includes(file.name));
      if (first) openImported(first);
      setPreview(null);
      setProvider(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not import profile documents.');
    } finally {
      setPending(false);
    }
  }
  async function unlink(id: string) {
    setPending(true);
    setError('');
    try {
      await action(
        `/profile/sources/${id}`,
        'DELETE',
        undefined,
        'Source removed; local notes kept',
      );
      setSources(await api<ProfileSource[]>('/profile/sources'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove source.');
    } finally {
      setPending(false);
    }
  }
  function toggle(name: string) {
    setSelected((current) =>
      current.includes(name) ? current.filter((value) => value !== name) : [...current, name],
    );
  }
  return {
    sources,
    provider,
    setProvider,
    repository,
    setRepository,
    path,
    setPath,
    branch,
    setBranch,
    folder,
    setFolder,
    preview,
    setPreview,
    selected,
    setSelected,
    toggle,
    error,
    busy,
    canRead,
    connection,
    previewSource,
    load,
    unlink,
    importSelected: () => requestImport(() => void importSelected()),
  };
}
