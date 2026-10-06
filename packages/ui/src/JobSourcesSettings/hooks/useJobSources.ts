import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { JobScanSummary, JobSource, JobSourcePreview } from '@pitchcrew/core';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { loadJobSources, previewJobSource } from '../api.ts';
import { emptyDraft } from '../constants.ts';
import {
  boardFromLink,
  draftInput,
  scanSummaryText,
  sourceDraft,
  tokenFromInput,
} from '../helpers.ts';
import type { SourceDraft } from '../types.ts';

const message = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export function useJobSources() {
  const action = useWorkspaceStore((state) => state.action);
  const working = useWorkspaceStore((state) => state.working);
  const [sources, setSources] = useState<JobSource[]>([]);
  const [draft, setDraft] = useState<SourceDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<JobSourcePreview | null>(null);
  const [summary, setSummary] = useState<JobScanSummary | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const previewController = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void loadJobSources(controller.signal)
      .then(setSources)
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(message(e, 'Could not load job sources.'));
      });
    return () => {
      controller.abort();
      previewController.current?.abort();
    };
  }, []);
  async function run(task: () => Promise<void>, fallback: string) {
    setPending(true);
    setError('');
    try {
      await task();
    } catch (e) {
      setError(message(e, fallback));
    } finally {
      setPending(false);
    }
  }
  const refresh = async () => setSources(await loadJobSources());
  function edit(next: SourceDraft | null, id: string | null = null) {
    previewController.current?.abort();
    setDraft(next);
    setEditingId(id);
    setPreview(null);
    setError('');
  }
  function update(patch: Partial<SourceDraft>) {
    previewController.current?.abort();
    setPreview(null);
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const path = editingId ? `/job-sources/${editingId}` : '/job-sources';
    void run(async () => {
      await action(path, editingId ? 'PUT' : 'POST', draftInput(draft), 'Job source saved');
      await refresh();
      edit(null);
    }, 'Could not save the job source.');
  };
  const test = () =>
    draft &&
    void run(async () => {
      previewController.current?.abort();
      const controller = new AbortController();
      previewController.current = controller;
      try {
        const result = await previewJobSource(draftInput(draft), controller.signal);
        if (!controller.signal.aborted) setPreview(result);
      } catch (error) {
        if (!controller.signal.aborted) throw error;
      }
    }, 'Could not read the job board.');
  const remove = (source: JobSource) =>
    void run(async () => {
      await action(`/job-sources/${source.id}`, 'DELETE', undefined, 'Job source removed');
      await refresh();
    }, 'Could not remove the job source.');
  const setEnabled = (source: JobSource, enabled: boolean) =>
    void run(async () => {
      const input = draftInput({ ...sourceDraft(source), enabled });
      await action(
        `/job-sources/${source.id}`,
        'PUT',
        input,
        enabled ? 'Source enabled' : 'Source paused',
      );
      await refresh();
    }, 'Could not update the job source.');
  const scan = () =>
    void run(async () => {
      const result = (await action('/job-sources/scan', 'POST', {}, (value) =>
        scanSummaryText(value as JobScanSummary),
      )) as JobScanSummary;
      setSummary(result);
      await refresh();
    }, 'Could not scan job sources.');
  return {
    sources,
    draft,
    editingId,
    preview,
    summary,
    error,
    busy: working || pending,
    startAdd: () => edit({ ...emptyDraft }),
    startEdit: (source: JobSource) => edit(sourceDraft(source), source.id),
    cancel: () => edit(null),
    update,
    setBoard: (value: string) => update(boardFromLink(value)),
    setToken: (value: string) => update(tokenFromInput(value)),
    save,
    test,
    remove,
    setEnabled,
    scan,
  };
}
