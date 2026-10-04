import type { Card } from '@pitchcrew/core';
import { LessonsEditor } from './components/LessonsEditor.tsx';
import { WeightControl } from './components/WeightControl.tsx';

/** User-only learning signals. Agents can read them through insights but never change them. */
export function LearningSignals({ card }: { card: Card }) {
  return (
    <section className="learning-signals mt-4" aria-label="Learning signals">
      <h3>What you learned</h3>
      <p className="quiet">
        Only you set these. Agents with application access read them before they write.
      </p>
      <WeightControl card={card} />
      <LessonsEditor card={card} />
    </section>
  );
}
