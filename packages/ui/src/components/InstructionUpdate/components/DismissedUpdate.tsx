import type { InstructionUpdateModel } from '../types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';

export function DismissedUpdate({ update, setExpanded }: InstructionUpdateModel) {
  return (
    <p className="quiet flex flex-wrap items-center gap-2">
      You kept your instructions. A newer default from{' '}
      {update.changes.at(-1)?.date ?? 'this release'} is still available.
      <Button className="button" onClick={() => setExpanded(true)}>
        Compare again
      </Button>
    </p>
  );
}
