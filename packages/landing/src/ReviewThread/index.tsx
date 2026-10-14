import { ApprovalBar } from './components/ApprovalBar';
import { ClaimTracer } from './components/ClaimTracer';

export function ReviewThread() {
  return (
    <section id="review" className="thread" aria-labelledby="review-title">
      <ClaimTracer
        intro={
          <>
            <h2 id="review-title" className="thread-title">
              Every line traced back to you.
            </h2>
            <p className="thread-lede">
              Here’s the Review step up close. Pick any line of this fictional resume to see the
              profile note it quotes and what Reviewer said about it.
            </p>
          </>
        }
        footer={<ApprovalBar />}
      />
    </section>
  );
}
