import { User } from 'lucide-react';
import type { Approval, Snapshot } from '@pitchcrew/core';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { submitterName } from '../helpers.ts';

/** The two ways to apply once the packet is approved; the choice itself happens in the footer. */
export const PacketThen = ({ approval, data }: { approval: Approval; data: Snapshot }) => {
  const submitter = submitterName(data);
  const chosen = approval.submission;
  return (
    <section>
      <h3 className="decide-rail-heading">Then</h3>
      {chosen ? (
        <p className="decide-why">
          {chosen.method === 'manual'
            ? 'You chose to apply yourself. The files are saved on this computer; apply on the posting, then record it here.'
            : 'This application was handed to an agent. Check its progress below. You approve the final submit click.'}
        </p>
      ) : (
        <>
          <div className="decide-then">
            <span className="decide-then-icon" aria-hidden="true">
              <User size={15} />
            </span>
            <div>
              <strong>Export to apply myself</strong>
              <span>Saves the files here. Nothing is sent; you apply on the posting</span>
            </div>
          </div>
          <div className="decide-then">
            <RoleAvatar agentRole="submitter" size="small" />
            <div>
              <strong>Let {submitter} prepare</strong>
              <span>You approve the final submit click</span>
            </div>
          </div>
          <p className="decide-why">
            {approval.status === 'pending'
              ? 'You’ll choose one after approving. The packet waits here until you do.'
              : 'Choose one below. The packet waits here until you do.'}
          </p>
        </>
      )}
    </section>
  );
};
