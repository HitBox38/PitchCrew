import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import type { RailCrew } from '../types.ts';

/**
 * The crew in one line that opens Crew: the working agents as pebbles (idle agents are only
 * counted), the count, and under it what is unusual ("Writer on 2 jobs"), so it never wraps at a
 * separator and its chevron ends on the rail's edge.
 */
export const CrewLine = ({ crew }: { crew: RailCrew }) => (
  <div className="home-block home-crew-block">
    <h2 className="sr-only">Crew</h2>
    <Link to="/crew" className="home-crew">
      {crew.working.length ? (
        <span className="home-crew-pebbles" aria-hidden="true">
          {crew.working.map((id) => (
            <RoleAvatar key={id} agentRole={id} size="small" />
          ))}
        </span>
      ) : null}
      <span className="home-crew-text">
        <span className="home-crew-count">{crew.summary}</span>
        {crew.multi.length ? (
          <span className="home-crew-more">
            <span className="sr-only">, </span>
            {crew.multi.join(', ')}
          </span>
        ) : null}
      </span>
      <ChevronRight size={16} className="home-crew-chevron" aria-hidden="true" />
    </Link>
  </div>
);
