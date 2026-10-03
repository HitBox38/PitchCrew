import { ExternalConfirmation } from './ExternalConfirmation.tsx';
import type { JobOverviewProps } from '../types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';

export function SubmissionReceipts({
  card,
  act,
  working,
}: Pick<JobOverviewProps, 'card' | 'act' | 'working'>) {
  return card.submissionAttempts?.length ? (
    <section className="my-4 space-y-3">
      <h3>Browser submissions</h3>
      {card.submissionAttempts.map((attempt) => (
        <div className="rounded border p-3" key={attempt.id}>
          <strong>
            {attempt.status === 'uncertain'
              ? 'Outcome needs verification'
              : attempt.status === 'confirmed'
                ? 'Submission verified'
                : 'Verified as not submitted'}
          </strong>
          <p className="quiet">
            {new Date(attempt.createdAt).toLocaleString()} · {attempt.before.url}
          </p>
          {attempt.externalConfirmation ? (
            <p className="quiet">
              User-verified external confirmation: {attempt.externalConfirmation.url} ?{' '}
              {attempt.externalConfirmation.evidence}
            </p>
          ) : null}
          {attempt.evidence ? (
            <blockquote className="my-2 whitespace-pre-wrap">{attempt.evidence}</blockquote>
          ) : null}
          {attempt.confirmation ? (
            <details>
              <summary>Full confirmation evidence</summary>
              <p>{attempt.confirmation.url}</p>
              <pre className="packet-document">{attempt.confirmation.text}</pre>
            </details>
          ) : null}
          {attempt.status === 'uncertain' ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                disabled={working || !attempt.confirmation}
                onClick={() =>
                  act(
                    `/submissions/${attempt.id}/resolve`,
                    {
                      confirmed: true,
                      reason: 'User verified captured website submission confirmation',
                    },
                    'Submission verified',
                  )
                }
              >
                I verified submission
              </Button>
              <ExternalConfirmation id={attempt.id} act={act} working={working} />
              <Button
                disabled={working}
                onClick={() =>
                  act(
                    `/submissions/${attempt.id}/resolve`,
                    {
                      confirmed: false,
                      reason: 'User verified no submission occurred; browser actions may resume',
                    },
                    'Outcome resolved; submission may be attempted again',
                  )
                }
              >
                I verified it was not submitted
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </section>
  ) : null;
}
