import { Hand, PencilLine, RotateCw, TriangleAlert } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { AccordionSection } from '@pitchcrew/design-system/accordion';

const editAddress = () => {
  const address = document.querySelector<HTMLInputElement>(
    '#agent-browser-panel [aria-label="Browser address"]',
  );
  address?.focus();
  address?.select();
};

/**
 * A failed or crashed tab, with the existing reload and take-control actions. An address that
 * couldn't be found is most likely a typo, so editing it leads and Retry follows.
 */
export const ClayPageError = ({
  error,
  details,
  crashed,
  manual,
  working,
  reload,
  take,
  host,
}: {
  /** The site the tab was loading, named in the heading when known. */
  host?: string;
  error: string;
  details?: string;
  crashed: boolean;
  manual: boolean;
  working: boolean;
  reload: () => void;
  /** Absent while the user already holds control. */
  take?: () => void;
}) => (
  <div className="browser-page-error clay-browser-state" role="alert">
    <div className="clay-browser-orb" data-tone="rose" aria-hidden="true">
      <TriangleAlert />
    </div>
    <h3>
      {crashed
        ? 'This page stopped responding'
        : host
          ? `Can’t reach ${host}`
          : 'This page didn’t load'}
    </h3>
    <p>{error}</p>
    {details ? (
      <AccordionSection heading="Technical details" className="text-left break-words">
        <p>{details}</p>
      </AccordionSection>
    ) : null}
    <div className="clay-browser-state-actions">
      {take ? (
        <Button size="sm" disabled={working} onClick={take}>
          <Hand size={14} />
          Take control
        </Button>
      ) : !crashed && error.includes('couldn’t be found') ? (
        <>
          <Button size="sm" disabled={!manual} onClick={editAddress}>
            <PencilLine size={14} />
            Edit address
          </Button>
          <Button size="sm" variant="ghost" disabled={!manual} onClick={reload}>
            <RotateCw size={14} />
            Retry page
          </Button>
        </>
      ) : (
        <Button size="sm" disabled={!manual} onClick={reload}>
          <RotateCw size={14} />
          {crashed ? 'Reload page' : 'Retry page'}
        </Button>
      )}
    </div>
    {take ? <p className="quiet">You can reload it once you have control.</p> : null}
  </div>
);
