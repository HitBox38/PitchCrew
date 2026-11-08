import { Hand } from 'lucide-react';

/** The quiet strip over a page the user is controlling privately. The header carries Private. */
export const ClayControlBar = ({ name, implicit }: { name?: string; implicit?: boolean }) => (
  <output className="clay-control-bar" data-implicit={implicit || undefined}>
    <Hand size={13} aria-hidden="true" />
    <span>
      {implicit
        ? `You’re browsing. ${name ?? 'Your agent'} gets the page back when it starts working.`
        : `You’re controlling. ${name ?? 'Your agent'} is paused.`}
    </span>
  </output>
);
