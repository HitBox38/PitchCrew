import { BriefSummary } from '@/ApplicationBriefReview/components/BriefSummary.tsx';
import { brief } from '../demo/data';

// Mirrors the app's ApplicationBriefReview wrapper; the summary inside is the app component.
export function JobBrief() {
  return (
    <section className="my-4 grid gap-3 rounded-lg border p-4" aria-label="Application brief">
      <div>
        <h3>Application brief</h3>
        <p className="quiet">
          Confirmed for drafting. Changes need another confirmation and packet review.
        </p>
      </div>
      <BriefSummary value={brief} />
    </section>
  );
}
