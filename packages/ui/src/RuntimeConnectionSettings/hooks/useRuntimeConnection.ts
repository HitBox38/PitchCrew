import { useEffect, useRef, useState } from 'react';
import type { RuntimeConnectionState, RuntimeId } from '@pitchcrew/core';
import { api, ApiHttpError } from '@/api.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { connectionValidationMessage } from '../helpers.ts';

export const useRuntimeConnection = (runtime: RuntimeId) => {
  const [state, setState] = useState<RuntimeConnectionState | null>(null);
  const [changes, setChanges] = useState<Record<string, string | null>>({});
  const [incomplete, setIncomplete] = useState<Record<string, true>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  const reads = useRef(0);
  const reload = async () => {
    const read = ++reads.current;
    try {
      const result = await api<RuntimeConnectionState>(`/runtimes/${runtime}/connection`);
      if (!mounted.current || read !== reads.current) return false;
      setState(result);
      setError('');
      return true;
    } catch {
      if (mounted.current && read === reads.current)
        setError('Could not load authentication settings. Retry loading before making changes.');
      return false;
    }
  };
  useEffect(() => {
    mounted.current = true;
    const read = ++reads.current;
    void api<RuntimeConnectionState>(`/runtimes/${runtime}/connection`)
      .then((result) => {
        if (mounted.current && read === reads.current) {
          setState(result);
          setError('');
        }
      })
      .catch(() => {
        if (mounted.current && read === reads.current)
          setError('Could not load authentication settings. Retry loading before making changes.');
      });
    return () => {
      mounted.current = false;
    };
  }, [runtime]);
  const change = (name: string, value: string | null) => {
    setIncomplete((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
    setNotice('');
    const field = state?.fields.find((item) => item.name === name);
    setChanges((current) => {
      const next = { ...current, [name]: value };
      if (value === null && (field?.source === 'inherited' || field?.source === 'unset'))
        delete next[name];
      if (!field?.secret && field?.source === 'saved' && value === field.value) delete next[name];
      return next;
    });
  };
  const undo = (name: string) => {
    setIncomplete((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
    setChanges((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
    setError('');
    setNotice('');
  };
  const save = async () => {
    if (pending.current || !state || !Object.keys(changes).length || Object.keys(incomplete).length)
      return false;
    pending.current = true;
    reads.current++;
    setWorking(true);
    setError('');
    setNotice('');
    try {
      const result = await api<RuntimeConnectionState>(`/runtimes/${runtime}/connection`, 'PUT', {
        revision: state.revision,
        changes,
      });
      if (!mounted.current) return;
      setState(result);
      setChanges({});
      setIncomplete({});
      setNotice('Authentication settings saved. Recheck sign-in before starting work.');
      try {
        await useWorkspaceStore.getState().reload();
      } catch {
        if (mounted.current)
          setError('Settings were saved, but account status could not refresh. Recheck sign-in.');
      }
      return true;
    } catch (failure) {
      if (!mounted.current) return;
      if (failure instanceof ApiHttpError && failure.status === 409) {
        const loaded = await reload();
        if (loaded)
          setError(
            'Authentication settings changed in another window. Your draft is kept; review the saved settings and save again.',
          );
      } else
        setError(
          (failure instanceof ApiHttpError && failure.status === 400
            ? connectionValidationMessage(failure.serverMessage)
            : undefined) ?? 'Authentication settings could not be saved. Your draft is kept.',
        );
      return false;
    } finally {
      pending.current = false;
      if (mounted.current) setWorking(false);
    }
  };
  return {
    state,
    changes,
    incomplete,
    error,
    notice,
    working,
    change,
    undo,
    typeValue: (name: string, value: string) => {
      if (value !== '') return change(name, value);
      if (state?.fields.find((field) => field.name === name)?.secret) return undo(name);
      setChanges((current) => ({ ...current, [name]: '' }));
      setIncomplete((current) => ({ ...current, [name]: true }));
      setError('');
      setNotice('');
    },
    recovered: (backup: string) => {
      setChanges({});
      setIncomplete({});
      setNotice(
        `Authentication settings reset. Backup kept as ${backup}. Daemon environment values apply again. Recheck sign-in before starting work.`,
      );
    },
    save,
    reload,
    dirty: !!Object.keys(changes).length,
    discard: () => {
      setChanges({});
      setIncomplete({});
      setError('');
      setNotice('');
    },
  };
};
