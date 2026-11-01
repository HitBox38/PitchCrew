import type { InstructionUpdateModel } from '../types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';

export const DismissedUpdate = ({ update, setExpanded }: InstructionUpdateModel) => {
  return (
    <p className="ui-empty instruction-update-dismissed">
      <span>
        You kept your instructions. A newer default from{' '}
        {update.changes.at(-1)?.date ?? 'this release'} is still available.
      </span>
      <Button className="button small" onClick={() => setExpanded(true)}>
        Compare again
      </Button>
    </p>
  );
};
