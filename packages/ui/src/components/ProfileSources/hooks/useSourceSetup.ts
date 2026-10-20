import { useState } from 'react';
import type { SourceIntent, SourceProvider } from '../types.ts';

export const useSourceSetup = () => {
  const chooseProvider = (provider: SourceProvider) => {
    setProvider(provider);
    setIntent(provider === 'drive' ? 'notes' : null);
    setAdding(true);
  };
  const chooseIntent = (intent: SourceIntent) => {
    setIntent(intent);
    setPath(intent === 'project' ? '' : 'about-me');
  };
  const startAdd = (provider?: SourceProvider) => {
    setRepository('');
    setPath('about-me');
    setBranch('');
    setFolder('');
    setProvider(provider ?? null);
    setIntent(provider === 'drive' ? 'notes' : null);
    setAdding(true);
  };

  const [adding, setAdding] = useState(false);
  const [provider, setProvider] = useState<SourceProvider | null>(null);
  const [intent, setIntent] = useState<SourceIntent | null>(null);
  const [repository, setRepository] = useState('');
  const [path, setPath] = useState('about-me');
  const [branch, setBranch] = useState('');
  const [folder, setFolder] = useState('');
  return {
    adding,
    setAdding,
    provider,
    intent,
    repository,
    setRepository,
    path,
    setPath,
    branch,
    setBranch,
    folder,
    setFolder,
    chooseProvider,
    chooseIntent,
    startAdd,
  };
};
