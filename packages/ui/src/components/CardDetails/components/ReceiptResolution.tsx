import { Button } from '@pitchcrew/design-system/button';
import type { JobOverviewProps } from '../types.ts';

/** Records the user's own verification of one attempt; it never retries the submission. */
export const ReceiptResolution = ({
  id,
  confirmed,
  act,
  working,
}: Pick<JobOverviewProps, 'act' | 'working'> & { id: string; confirmed: boolean }) => (
  <Button
    className="h-auto min-h-9.5 py-2 whitespace-normal"
    variant="outline"
    disabled={working}
    onClick={() =>
      act(
        `/submissions/${id}/resolve`,
        confirmed
          ? { confirmed, reason: 'User verified captured website submission confirmation' }
          : {
              confirmed,
              reason: 'User verified no submission occurred; browser actions may resume',
            },
        confirmed ? 'Submission verified' : 'Outcome resolved; submission may be attempted again',
      )
    }
  >
    {confirmed ? 'I verified submission' : 'I verified it was not submitted'}
  </Button>
);
