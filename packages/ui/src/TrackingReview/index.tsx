import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { TrackingProposal } from './components/TrackingProposal.tsx';

export function TrackingReview() {
  const data = useWorkspaceStore((state) => state.data);
  const pending = data?.trackingSignals?.filter((signal) => signal.status === 'pending') ?? [];
  if (!data || !pending.length) return null;
  return (
    <section
      className="my-5 rounded-lg border border-border p-4"
      aria-label="Application tracking review"
    >
      <h2>Application updates need review</h2>
      <p className="quiet">
        Choose the application and verify the email evidence before applying a status change.
        Register an external application first if it is missing.
      </p>
      {pending.map((signal) => (
        <TrackingProposal key={signal.id} signal={signal} cards={data.cards} />
      ))}
    </section>
  );
}
