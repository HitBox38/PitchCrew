import { Button } from '@/components/ui/button/components/Button.tsx';
import { Checkbox } from '@/components/ui/checkbox/components/Checkbox.tsx';
import { Textarea } from '@/components/ui/textarea/components/Textarea.tsx';
import type { StaleCleanupModel } from '../hooks/useStaleCleanup.ts';

export function StaleList({ stale }: { stale: StaleCleanupModel }) {
  const preview = stale.preview!;
  if (!preview.cards.length)
    return (
      <p className="quiet mt-3">
        No submitted job has gone {preview.days} days without a status change.
      </p>
    );
  return (
    <div className="mt-3 flex flex-col gap-3">
      <ul className="flex flex-col gap-2" aria-label="Silent applications">
        {preview.cards.map((card) => (
          <li key={card.id}>
            <label className="checkbox-label flex items-start gap-3">
              <Checkbox
                aria-label={`${card.company} · ${card.title}`}
                disabled={Boolean(card.blocked)}
                checked={stale.selected.includes(card.id)}
                onCheckedChange={(checked) => stale.toggle(card.id, checked)}
              />
              <span>
                {card.company} · {card.title}
                <small className="quiet block">
                  {card.blocked ||
                    `No status change for ${card.idleDays} days, since ${new Date(card.since).toLocaleDateString()}`}
                </small>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <label className="field">
        Note for job history (optional)
        <Textarea
          value={stale.note}
          maxLength={500}
          rows={2}
          onChange={(event) => stale.setNote(event.target.value)}
        />
      </label>
      <div>
        <Button
          className="button"
          disabled={!stale.selected.length || stale.working}
          onClick={() => stale.setConfirming(true)}
        >
          Review {stale.selected.length} selected
        </Button>
      </div>
    </div>
  );
}
