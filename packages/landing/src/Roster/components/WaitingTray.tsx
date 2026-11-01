'use client';

import { Download, FileCheck2 } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { Bead } from '../../components/clay/Bead';
import { Pebble } from '../../components/clay/Pebble';
import { platforms } from '../../Downloads/constants';
import { usePlatform } from '../../Downloads/hooks/usePlatform';
import { stages } from '../constants';
import { Anchor } from '../../components/clay/Anchor';

/** The crew stops here: an ochre decision that is the visitor's, and the page's primary action. */
export const WaitingTray = ({ open }: { open: boolean }) => {
  const { platform } = usePlatform();
  const label = platforms.find((item) => item.id === platform)?.label ?? 'your computer';
  return (
    <div className="waiting" data-open={open ? '' : undefined}>
      <h3 className="waiting-title">
        <Bead tone={open ? 'ochre' : undefined} />
        Waiting on you <span className="roster-count tabular">{open ? 1 : 0}</span>
      </h3>
      <div className="clay-card decision" aria-hidden={!open}>
        <div className="decision-job">
          <Pebble size={34}>F</Pebble>
          <div className="min-w-0">
            <p className="decision-company">Forma · Design Engineer</p>
            <p className="decision-ask">Packet ready to approve. 4 of 4 claims quote your notes.</p>
          </div>
        </div>
        <ol className="track decision-track" aria-label="Where the job stands">
          <span className="track-fill" style={{ '--fill': 0.5 } as React.CSSProperties} />
          {stages.map((stage, index) => (
            <li key={stage}>
              <Bead
                size="sm"
                tone={index < 4 ? 'primary' : index === 4 ? 'ochre' : undefined}
                label={index === 4 ? `${stage}, waiting on you` : stage}
              />
            </li>
          ))}
        </ol>
        <div className="decision-actions">
          <Button
            render={<Anchor href="#download" />}
            nativeButton={false}
            tabIndex={open ? undefined : -1}
          >
            <Download aria-hidden="true" />
            Download for {label}
          </Button>
          <Button
            variant="secondary"
            render={<Anchor href="#packet" />}
            nativeButton={false}
            tabIndex={open ? undefined : -1}
          >
            <FileCheck2 aria-hidden="true" />
            See the packet
          </Button>
          <p className="fine decision-fine">
            This decision is yours in the app. Nothing on this page is sent anywhere.
          </p>
        </div>
      </div>
    </div>
  );
};
