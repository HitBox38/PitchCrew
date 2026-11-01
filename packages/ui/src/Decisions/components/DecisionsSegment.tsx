import { useNavigate } from '@tanstack/react-router';

/** Decisions waiting now and the ones already made share one page; the view lives in the URL. */
export const DecisionsSegment = ({ history, count }: { history: boolean; count: number }) => {
  const navigate = useNavigate({ from: '/inbox' });
  return (
    <fieldset className="ui-segment" aria-label="Decisions view">
      <button type="button" aria-pressed={!history} onClick={() => void navigate({ search: {} })}>
        To decide
        {count ? <span className="ui-count">{count}</span> : null}
      </button>
      <button
        type="button"
        aria-pressed={history}
        onClick={() => void navigate({ search: { view: 'history' } })}
      >
        History
      </button>
    </fieldset>
  );
};
