import { Brand } from '@/components/Brand/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { LoaderCircle } from 'lucide-react';
import type { useApp } from '../hooks/useApp.ts';

export function WorkspaceBoot({
  error,
  reload,
}: Pick<ReturnType<typeof useApp>, 'error' | 'reload'>) {
  return (
    <div className="boot">
      <Brand />
      <p>{error || 'Opening your local workspace…'}</p>
      {error ? (
        <Button className="button" onClick={() => void reload().catch(() => {})}>
          Try again
        </Button>
      ) : (
        <LoaderCircle className="spin" size={22} />
      )}
    </div>
  );
}
