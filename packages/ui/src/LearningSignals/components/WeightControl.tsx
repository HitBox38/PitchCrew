import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { signedWeight, weightLabels } from '@/lib/labels.ts';
import type { Card } from '@pitchcrew/core';
import { cardWeight, weights } from '@pitchcrew/core/insights';

export function WeightControl({ card }: { card: Card }) {
  const act = useWorkspaceStore((state) => state.act);
  const working = useWorkspaceStore((state) => state.working);
  const current = cardWeight(card);
  return (
    <fieldset className="weight-control my-3">
      <legend className="font-semibold">Weight</legend>
      <p className="quiet">How well this application went for you, apart from the outcome.</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {weights.map((weight) => (
          <Button
            key={weight}
            className="button small"
            aria-pressed={current === weight}
            disabled={working || current === weight}
            onClick={() =>
              act(
                `/cards/${card.id}/weight`,
                'PUT',
                { weight },
                `Weight set to ${weightLabels[weight].toLowerCase()}`,
              )
            }
          >
            {signedWeight(weight)} {weightLabels[weight]}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}
