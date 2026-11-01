'use client';

import { useState } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import { Bead } from '../../components/clay/Bead';

type Outcome = 'asked' | 'approved' | 'denied';

/** The compact browser panel with its one-line approval tray. The decision stays with you. */
export const BrowserTray = () => {
  const [outcome, setOutcome] = useState<Outcome>('asked');
  return (
    <div className="browser clay-card" data-ui="" aria-label="Fictional browser panel">
      <div className="browser-bar">
        <span className="chip" data-tone="primary">
          Supervised
        </span>
        <span className="browser-address">boards.greenhouse.io › forma › design-engineer</span>
      </div>
      <div className="browser-page">
        <p className="browser-form-title">Application · Design Engineer</p>
        <ul className="browser-fields" aria-label="Form fields filled from the approved packet">
          {fields.map((field) => (
            <li key={field}>
              <Bead tone="primary" size="sm" />
              {field}
            </li>
          ))}
        </ul>
        <p className="fine">9 of 9 fields filled from the packet you approved. Fictional form.</p>
      </div>
      <div className="browser-approval" data-outcome={outcome} aria-live="polite">
        <Bead
          tone={outcome === 'asked' ? 'ochre' : outcome === 'approved' ? 'moss' : 'rose'}
          live={outcome === 'asked'}
        />
        <p className="browser-ask">
          {outcome === 'asked'
            ? 'Submitter asks to press “Submit application”.'
            : outcome === 'approved'
              ? 'Submitted. The receipt is saved with the job.'
              : 'Denied. Submitter stops and tells you why it asked.'}
        </p>
        {outcome === 'asked' ? (
          <div className="browser-actions">
            <Button variant="secondary" size="sm" onClick={() => setOutcome('denied')}>
              Deny
            </Button>
            <Button size="sm" onClick={() => setOutcome('approved')}>
              Approve
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setOutcome('asked')}>
            Ask again
          </Button>
        )}
      </div>
    </div>
  );
};

const fields = [
  'Name and contact',
  'Resume.pdf · frozen bytes',
  'Cover letter',
  'Work authorization',
];
