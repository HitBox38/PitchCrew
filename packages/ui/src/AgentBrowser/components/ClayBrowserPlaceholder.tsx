import type { ReactNode } from 'react';
import { Globe, Hand } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';

/** The empty and opening page: one orb, a sentence and the existing action. */
export const ClayBrowserPlaceholder = ({
  loading,
  opened,
  manual,
  name,
  working,
  act,
  children,
}: {
  loading: boolean;
  opened: boolean;
  manual: boolean;
  name?: string;
  working: boolean;
  act: () => void;
  children?: ReactNode;
}) => {
  const Icon = !opened ? Globe : Hand;
  const agent = name ?? 'your agent';
  return (
    <div className="browser-placeholder clay-browser-state" aria-busy={loading}>
      <div className="clay-browser-orb" data-raised={loading || undefined} aria-hidden="true">
        {loading ? <span className="clay-job-spinner" /> : <Globe />}
      </div>
      <h3 role={loading ? 'status' : undefined}>
        {loading
          ? opened
            ? 'Connecting to the browser…'
            : 'Opening the browser…'
          : opened
            ? 'New tab'
            : 'Browser not open'}
      </h3>
      <p>
        {loading
          ? `${name ? `${name}’s` : 'This agent’s'} browser keeps its own sign-ins, separate from yours and from the other agents.`
          : manual
            ? 'Type an address or a search above.'
            : opened
              ? `Ask ${agent} to open a page, or take control and browse yourself. Sign-ins in this browser are kept.`
              : `Ask ${agent} to browse, or open the browser to sign in. Sign-ins in this browser are kept.`}
      </p>
      {/* A usable blank tab needs no button: the address field above is the action. */}
      {!loading && !(opened && manual) ? (
        <Button size="sm" variant="outline" disabled={working} onClick={act}>
          <Icon size={15} />
          {opened ? 'Take control' : 'Open browser'}
        </Button>
      ) : null}
      {!loading ? children : null}
    </div>
  );
};
