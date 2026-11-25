import { Link } from '@tanstack/react-router';
import { Button } from '@pitchcrew/design-system/button';
import type { RailModel } from '../types.ts';

/**
 * Where the board went: a small ledger of open jobs by stage, Closed set apart, and one way to
 * Pipeline. Leads that wait on nobody are a number here, not a row in Needs you; the unscored
 * ones link to Pipeline's table on its Not scored view.
 */
export const PipelineCounts = ({ pipeline }: { pipeline: RailModel['pipeline'] }) => (
  <div className="home-block home-pipeline">
    <header className="home-block-head">
      <h2 className="home-heading" data-section-title="">
        Pipeline <span className="home-count">{pipeline.open} open</span>
      </h2>
      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        render={<Link to="/pipeline" />}
        className="home-link"
      >
        Open pipeline
      </Button>
    </header>
    <dl className="home-stages">
      {pipeline.stages.map((stage) => (
        <div key={stage.id} className="home-stage">
          <dt>
            {stage.label}
            {stage.id === 'lead' && pipeline.notScored ? (
              <Link
                to="/pipeline"
                search={{ mode: 'table', view: 'not-scored' }}
                className="home-stage-note"
              >
                {pipeline.notScored} not scored
              </Link>
            ) : null}
          </dt>
          <dd>{stage.count}</dd>
        </div>
      ))}
      <div className="home-stage" data-closed="">
        <dt>Closed</dt>
        <dd>{pipeline.closed}</dd>
      </div>
    </dl>
  </div>
);
