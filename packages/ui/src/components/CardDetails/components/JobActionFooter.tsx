import type { ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import type { JobDock } from '../dock.ts';

/**
 * The job's Now dock: one sentence for whose move it is and the controls that act on it. Recessed
 * while an agent, the queue or the employer has the move; raised (ochre for a question or decision)
 * when it is the user's. A failed run stays visible as evidence beside the still-valid action.
 */
export const JobActionFooter = ({
  dock,
  spinning,
  panel,
  children,
}: {
  dock: JobDock;
  spinning?: boolean;
  /** Full-width content that opens above the sentence, such as a question's answer form. */
  panel?: ReactNode;
  children?: ReactNode;
}) => {
  const tone = dock.tone;
  return (
    <footer
      className="detail-footer job-dock"
      data-material={dock.material}
      data-tone={dock.failure ? 'rose' : tone}
      data-panel={panel ? '' : undefined}
      aria-label="Next step"
    >
      {panel}
      {/* Keyed by the sentence so each new step settles in with the shared clay motion. */}
      <div className="job-dock-text" key={dock.line}>
        {dock.line ? (
          <output className="job-dock-line">
            {spinning ? (
              <LoaderCircle
                size={14}
                className="spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : tone ? (
              <span
                className="clay-bead"
                data-size="sm"
                data-tone={dock.failure ? 'rose' : tone}
                data-live={dock.live ? '' : undefined}
                aria-hidden="true"
              />
            ) : null}
            <span className="job-dock-sentence">{dock.line}</span>
          </output>
        ) : null}
        {dock.failure ? (
          <p className="job-dock-detail" data-failure="" title={dock.detail ?? undefined}>
            <span className="clay-bead" data-size="sm" data-tone="rose" aria-hidden="true" />
            Last run: {dock.failure}
          </p>
        ) : dock.detail ? (
          <p className="job-dock-detail" title={dock.detail}>
            {dock.detail}
          </p>
        ) : null}
      </div>
      {children ? <div className="job-dock-actions">{children}</div> : null}
    </footer>
  );
};
