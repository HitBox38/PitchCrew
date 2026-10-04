import { Modal } from '@/components/Modal/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { StaleCleanupModel } from '../hooks/useStaleCleanup.ts';

export function StaleConfirm({ stale }: { stale: StaleCleanupModel }) {
  const cards = stale.preview!.cards.filter((card) => stale.selected.includes(card.id));
  const close = () => {
    if (!stale.working) stale.setConfirming(false);
  };
  return (
    <Modal title="Mark as no response" onClose={close}>
      <p>
        Move {cards.length} {cards.length === 1 ? 'job' : 'jobs'} from Submitted to No response?
        Each change takes effect from the day it reached {stale.preview!.days} days of silence, so a
        later reply can still move it forward.
      </p>
      <ul className="quiet my-3 max-h-48 overflow-y-auto">
        {cards.map((card) => (
          <li key={card.id}>
            {card.company} · {card.title} · since {new Date(card.staleAt).toLocaleDateString()}
          </li>
        ))}
      </ul>
      <div className="mt-5 flex justify-end gap-2">
        <Button className="button" disabled={stale.working} onClick={close}>
          Cancel
        </Button>
        <Button
          className="button primary"
          disabled={stale.working}
          onClick={() => void stale.apply()}
        >
          Mark as no response
        </Button>
      </div>
    </Modal>
  );
}
