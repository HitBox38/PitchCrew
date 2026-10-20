import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible/index.tsx';
import { RuntimeRow } from '@/RuntimeMaintenance/components/RuntimeRow.tsx';
import type { Snapshot } from '@pitchcrew/core';
import { ChevronDown } from 'lucide-react';
import { useSearch } from '@tanstack/react-router';

const RuntimeRows = ({ runtimes }: { runtimes: Snapshot['runtimes'] }) => {
  const { runtime: selected } = useSearch({ from: '/settings' });
  return (
    <div className="runtime-installations">
      {runtimes.map((runtime) => (
        <RuntimeRow key={`${runtime.id}-${selected === runtime.id}`} runtime={runtime} />
      ))}
    </div>
  );
};

export const RuntimeList = ({ runtimes }: { runtimes: Snapshot['runtimes'] }) => {
  const { runtime: selected } = useSearch({ from: '/settings' });
  const available = runtimes.filter(
    (runtime) => runtime.id !== 'demo' && (runtime.available || !!runtime.version),
  );
  const unavailable = runtimes.filter((runtime) => !runtime.available && !runtime.version);
  const demo = runtimes.find((runtime) => runtime.id === 'demo');
  return (
    <section className="runtime-section" aria-labelledby="runtime-heading">
      <div className="section-heading mb-3 flex items-baseline justify-between gap-3">
        <h2 id="runtime-heading">Installed runtimes</h2>
      </div>
      <RuntimeRows runtimes={available} />
      {!available.length ? (
        <div className="settings-empty p-5">
          <h3>No agent CLIs found</h3>
          <p className="quiet mt-1">
            Open the runtimes below for setup instructions. Once installed, recheck to make them
            available to your crew.
          </p>
        </div>
      ) : null}
      {unavailable.length ? (
        <Collapsible
          key={unavailable.some((entry) => entry.id === selected) ? selected : 'other'}
          className="runtime-discovery"
          defaultOpen={unavailable.some((entry) => entry.id === selected)}
        >
          <CollapsibleTrigger className="runtime-discovery-trigger">
            <ChevronDown size={16} aria-hidden="true" /> Add another runtime
            <span>{unavailable.length} supported</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <RuntimeRows runtimes={unavailable} />
          </CollapsibleContent>
        </Collapsible>
      ) : null}
      {demo ? (
        <Collapsible className="runtime-discovery">
          <CollapsibleTrigger className="runtime-discovery-trigger">
            <ChevronDown size={16} aria-hidden="true" /> Development demo
          </CollapsibleTrigger>
          <CollapsibleContent>
            <RuntimeRow runtime={demo} />
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </section>
  );
};
