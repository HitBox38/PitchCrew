import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pitchcrew/design-system/collapsible';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import type { LensRow } from '@/lib/crew-lens.ts';

/**
 * Idle agents rest together in one recessed tray at the end, folded until asked for: their faces,
 * "{n} idle" and their names, opening to each one's runtime and idle facts.
 */
export const LensIdle = ({ rows }: { rows: LensRow[] }) => {
  if (!rows.length) return null;
  return (
    <Collapsible className="crew-lens-idle">
      <CollapsibleTrigger className="crew-lens-idle-trigger">
        <span className="crew-lens-idle-lead">
          <span className="crew-lens-idle-faces" aria-hidden="true">
            {rows.map((row) => (
              <RoleAvatar key={row.roleId} agentRole={row.roleId} size="small" />
            ))}
          </span>
          <strong>{rows.length} idle</strong>
        </span>
        {/* Each name stays whole; a line that runs out of room wraps between names. */}
        <span className="crew-lens-idle-names">
          {rows.map((row, index) => (
            <span key={row.roleId}>
              {index ? ', ' : null}
              <span className="crew-lens-idle-whole">{row.name}</span>
            </span>
          ))}
        </span>
        <ChevronDown size={16} className="crew-lens-chevron" aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent className="crew-lens-idle-panel">
        <ul>
          {rows.map((row) => (
            <li key={row.roleId} className="crew-lens-idle-line">
              <RoleAvatar agentRole={row.roleId} size="small" />
              <div className="crew-lens-idle-copy">
                <p className="crew-lens-idle-name">
                  <strong>{row.name}</strong> <span className="crew-lens-meta">{row.meta}</span>
                </p>
                <p className="crew-lens-meta">{row.idleFact}</p>
              </div>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
};
