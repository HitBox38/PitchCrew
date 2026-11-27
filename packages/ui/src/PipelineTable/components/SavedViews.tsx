import { Button } from '@pitchcrew/design-system/button';
import { Bead } from '@/ClayInterface/components/Bead.tsx';
import { tableViews, trackNames } from '../constants.ts';
import { viewDef, viewFacts } from '../helpers.ts';
import type { TableModel } from '../hooks/usePipelineTable.ts';
import type { TableView } from '../types.ts';
import { ViewSelect } from './ViewSelect.tsx';

type Props = { model: TableModel; choose: (view: TableView) => void; phone: boolean };

const ids = (track?: number) =>
  tableViews.filter((view) => track === undefined || view.track === track).map((view) => view.id);
const scope = ids(0);
const beyondScope = tableViews.filter((view) => view.track !== 0).map((view) => view.id);

const Track = ({
  name,
  views,
  model,
  choose,
}: Omit<Props, 'phone'> & { name: string; views: readonly TableView[] }) => (
  <fieldset className="ui-segment saved-views" aria-label={name}>
    {views.map((id) => {
      const { count, tone } = viewFacts(viewDef(id), model.counts[id], model.query);
      return (
        <button key={id} type="button" aria-pressed={model.view === id} onClick={() => choose(id)}>
          {tone ? <Bead tone={tone === 'socket' ? undefined : tone} /> : null}
          {viewDef(id).label}
          <span className="ui-count">{count}</span>
        </button>
      );
    })}
  </fieldset>
);

/**
 * Saved views as three recessed tracks (scope, what the crew is doing, a lens), counts following
 * the search. When the tracks would wrap only Scope stays and the rest fold into "More views"; a
 * phone gets one View select and the Select toggle that shows row checkboxes.
 */
export const SavedViews = ({ model, choose, phone }: Props) => {
  const current = model.view ?? 'all';
  const select = (views: readonly TableView[], label: string, placeholder?: string) => (
    <ViewSelect
      views={views}
      current={current}
      counts={model.counts}
      query={model.query}
      choose={choose}
      label={label}
      placeholder={placeholder}
    />
  );
  if (phone)
    return (
      <div className="pipeline-phone-tools">
        {select(ids(), 'View')}
        {/* Its words say what a tap does next (Select, then Done), so it is no toggle button. */}
        <Button variant="outline" onClick={() => model.setSelecting(!model.selecting)}>
          {model.selecting ? 'Done' : 'Select'}
        </Button>
      </div>
    );
  return (
    <div className="saved-views-bar">
      <fieldset className="saved-views-set" data-set="full" aria-label="Saved views">
        {trackNames.map((name, track) => (
          <Track key={name} name={name} views={ids(track)} model={model} choose={choose} />
        ))}
      </fieldset>
      <div className="saved-views-set" data-set="compact">
        <Track name="Scope" views={scope} model={model} choose={choose} />
        {select(beyondScope, 'More views', 'More views')}
      </div>
    </div>
  );
};
