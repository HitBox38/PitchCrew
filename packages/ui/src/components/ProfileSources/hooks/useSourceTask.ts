import { useRef, useState } from 'react';

export function useSourceTask() {
  const lock = useRef(false);
  const [progress, setProgress] = useState<{ label: string; sourceId?: string } | null>(null);
  const [error, setError] = useState('');
  async function perform(label: string, action: () => Promise<void>, sourceId?: string) {
    if (lock.current) return;
    lock.current = true;
    setError('');
    setProgress({ label, sourceId });
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not update this source.');
    } finally {
      lock.current = false;
      setProgress(null);
    }
  }
  return { progress, error, setError, perform };
}
