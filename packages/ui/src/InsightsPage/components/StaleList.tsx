import { Button } from '@pitchcrew/design-system/button';
import { Checkbox } from '@pitchcrew/design-system/checkbox';
import { Textarea } from '@pitchcrew/design-system/textarea';
import { staleBatchLimit } from '@pitchcrew/core/insights';
import type { StaleCleanupModel } from '../hooks/useStaleCleanup.ts';

export const StaleList = ({ stale }: { stale: StaleCleanupModel }) => {
  const preview = stale.preview!;
  if (!preview.cards.length)
    return (
      <p className="ui-empty">
        No submitted job has gone {preview.days} days without a status change.
      </p>
    );
  const selectedIds = new Set(stale.selected);
  return (
    <div className="insights-stale">
      {preview.cards.length > staleBatchLimit ? (
        <p className="insights-note">
          Mark up to {staleBatchLimit} jobs at once. Find silent applications again to review the
          rest.
        </p>
      ) : null}
      <ul className="insights-stale-list" aria-label="Silent applications">
        {preview.cards.map((card) => (
          <li key={card.id}>
            <label className="insights-stale-row">
              <Checkbox
                aria-label={`${card.company} · ${card.title}`}
                disabled={
                  Boolean(card.blocked) ||
                  (!selectedIds.has(card.id) && stale.selected.length >= staleBatchLimit)
                }
                checked={selectedIds.has(card.id)}
                onCheckedChange={(checked) => stale.toggle(card.id, checked)}
              />
              <span>
                {card.company} · {card.title}
                <small>
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
};
