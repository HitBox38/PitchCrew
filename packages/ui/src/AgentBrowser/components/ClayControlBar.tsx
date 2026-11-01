import { EyeOff, Hand } from 'lucide-react';

/** The strip over a page the user is controlling privately. */
export const ClayControlBar = ({ name }: { name?: string }) => (
  <output className="clay-control-bar">
    <Hand size={15} aria-hidden="true" />
    <span>You’re controlling. {name ?? 'Your agent'} is paused.</span>
    <span className="clay-control-private">
      <EyeOff size={13} aria-hidden="true" />
      Private
    </span>
  </output>
);
