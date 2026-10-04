import { Modal } from '@/components/Modal/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { useTagMerge } from '../hooks/useTagMerge.ts';

export function TagMergeConfirm({ merge }: { merge: ReturnType<typeof useTagMerge> }) {
  const close = () => {
    if (!merge.working) merge.setConfirming(false);
  };
  return (
    <Modal title="Merge tags" onClose={close}>
      <p>
        Move {merge.affected.length} {merge.affected.length === 1 ? 'job' : 'jobs'} from{' '}
        <strong>{merge.from}</strong> to <strong>{merge.target}</strong>? The old tag is removed
        from every job. Job history keeps the earlier tags.
      </p>
      <ul className="quiet my-3 max-h-48 overflow-y-auto">
        {merge.affected.map((card) => (
          <li key={card.id}>
            {card.company} · {card.title}
          </li>
        ))}
      </ul>
      <div className="mt-5 flex justify-end gap-2">
        <Button className="button" disabled={merge.working} onClick={close}>
          Cancel
        </Button>
        <Button
          className="button primary"
          disabled={merge.working}
          onClick={() => void merge.merge()}
        >
          Merge tags
        </Button>
      </div>
    </Modal>
  );
}
