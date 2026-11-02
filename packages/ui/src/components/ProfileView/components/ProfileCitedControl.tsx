import { Quote } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import { Popover, PopoverContent, PopoverTrigger } from '@pitchcrew/design-system/popover';
import type { ProfileSectionProps } from '../types.ts';
import { ProfileCitationList } from './ProfileCitationList.tsx';

/** "Cited in N packets": opens the rail beside the note when there is room, else a popover. */
export const ProfileCitedControl = ({ controller, workspace, citations }: ProfileSectionProps) => {
  const [open, setOpen] = useState(false);
  const revealing = useRef(false);
  const count = citations.rows.length;
  if (!count) return null;
  const label = `Cited in ${count} ${count === 1 ? 'packet' : 'packets'}`;
  if (workspace.railRoom)
    return (
      <Button
        variant="ghost"
        size="xs"
        className="profile-cited"
        aria-pressed={workspace.citationsOpen}
        aria-controls="profile-citations"
        onClick={workspace.toggleCitations}
      >
        <Quote aria-hidden="true" /> {label}
      </Button>
    );
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) revealing.current = false;
        setOpen(next);
      }}
    >
      <PopoverTrigger render={<Button variant="ghost" size="xs" className="profile-cited" />}>
        <Quote aria-hidden="true" /> {label}
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="profile-cited-popover"
        finalFocus={() => !revealing.current}
      >
        <p className="profile-citations-heading">{label}</p>
        <ProfileCitationList
          rows={citations.rows}
          content={controller.content}
          reveal={(quote) => {
            revealing.current = true;
            setOpen(false);
            workspace.revealQuote(quote);
          }}
        />
      </PopoverContent>
    </Popover>
  );
};
