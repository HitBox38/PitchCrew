import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible/index.tsx';
import { RuntimeRow } from '@/RuntimeMaintenance/components/RuntimeRow.tsx';
import type { Snapshot } from '@pitchcrew/core';
import { ChevronDown } from 'lucide-react';

const RuntimeRows = ({ runtimes }: { runtimes: Snapshot['runtimes'] }) => {
  return (
    <div className="space-y-4">
      {runtimes.map((runtime) => (
        <RuntimeRow key={runtime.id} runtime={runtime} />
      ))}
    </div>
  );
};

export const RuntimeList = ({ runtimes }: { runtimes: Snapshot['runtimes'] }) => {
  const available = runtimes.filter((runtime) => runtime.available || !!runtime.version);
  const unavailable = runtimes.filter((runtime) => !runtime.available && !runtime.version);
  return (
    <section className="runtime-section" aria-labelledby="runtime-heading">
      <div className="section-heading mb-3 flex items-baseline justify-between gap-3">
        <h2 id="runtime-heading">Runtimes on this machine</h2>
        <span className="subtle">{available.length} installed</span>
      </div>
      <RuntimeRows runtimes={available} />
      {unavailable.length ? (
        <Collapsible className="runtime-discovery">
          <CollapsibleTrigger className="runtime-discovery-trigger">
            <ChevronDown size={16} aria-hidden="true" /> Other runtimes
            <span>{unavailable.length} unavailable</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <RuntimeRows runtimes={unavailable} />
          </CollapsibleContent>
        </Collapsible>
      ) : null}
      <p className="info-note">
        Demo uses scripted replies and drafts. Other runtimes use your CLI’s account for
        conversations and job workflows.
      </p>
    </section>
  );
};
