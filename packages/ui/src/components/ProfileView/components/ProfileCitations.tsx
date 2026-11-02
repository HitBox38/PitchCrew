import { X } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import type { ProfileSectionProps } from '../types.ts';
import { ProfileCitationList } from './ProfileCitationList.tsx';

/** The rail beside the note: packets whose registered claims quote its exact lines. */
export const ProfileCitations = ({ controller, workspace, citations }: ProfileSectionProps) => {
  const count = citations.rows.length;
  return (
    <aside
      id="profile-citations"
      className="profile-citations"
      aria-label="Packets citing this note"
    >
      <div className="profile-citations-heading">
        <h2>
          Cited in {count} {count === 1 ? 'packet' : 'packets'}
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Hide citations"
          onClick={() => {
            document.querySelector<HTMLButtonElement>('.profile-cited')?.focus();
            workspace.toggleCitations();
          }}
        >
          <X size={15} aria-hidden="true" />
        </Button>
      </div>
      <ProfileCitationList
        rows={citations.rows}
        content={controller.content}
        reveal={workspace.revealQuote}
      />
    </aside>
  );
};
