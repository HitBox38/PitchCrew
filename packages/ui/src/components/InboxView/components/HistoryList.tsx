import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { HistoryRow } from './HistoryRow.tsx';
import type { HistoryFilter, InboxViewModel } from '../types.ts';

const filters: [HistoryFilter, string][] = [
  ['all', 'All'],
  ['packet', 'Packets'],
  ['browser', 'Browser'],
];

export const HistoryList = (model: InboxViewModel) => (
  <div className="decision-history-list">
    <div className="decision-history-tools">
      <div className="search-input">
        <Search size={15} aria-hidden="true" />
        <Input
          aria-label="Search history"
          placeholder="Agent, job or filename…"
          value={model.search}
          onChange={(event) => model.setSearch(event.target.value)}
        />
      </div>
      <fieldset className="view-switch" aria-label="Decision type">
        {filters.map(([value, label]) => (
          <Button
            key={value}
            aria-pressed={value === model.filter}
            className={value === model.filter ? 'active' : ''}
            onClick={() => model.setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </fieldset>
    </div>
    <div className="decision-history-scroll">
      {model.groups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h3>{group.label}</h3>
          <ul>
            {group.requests.map((request) => (
              <HistoryRow key={request.key} request={request} model={model} />
            ))}
          </ul>
        </section>
      ))}
      {model.requests.length ? null : (
        <p className="decision-history-empty">
          {model.total ? 'No past decisions match.' : 'No past decisions yet.'}
        </p>
      )}
    </div>
  </div>
);
