import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible/index.tsx';
import { runtimeLabels } from '@/lib/labels.ts';
import type { Snapshot } from '@pitchcrew/core';
import { ChevronDown } from 'lucide-react';

function RuntimeRows({ runtimes }: { runtimes: Snapshot['runtimes'] }) {
  return (
    <div className="runtime-list">
      {runtimes.map((runtime) => (
        <div className="runtime-row" key={runtime.id}>
          <div>
            <strong>{runtimeLabels[runtime.id]}</strong>
            <p>{runtime.detail}</p>
          </div>
          {runtime.version ? <small>{runtime.version}</small> : null}
          <span className={`badge ${runtime.available ? 'success' : ''}`}>
            {runtime.available ? 'Available' : 'Unavailable'}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RuntimeList({ runtimes }: { runtimes: Snapshot['runtimes'] }) {
  const available = runtimes.filter((runtime) => runtime.available);
  const unavailable = runtimes.filter((runtime) => !runtime.available);
  return (
    <section className="runtime-section" aria-labelledby="runtime-heading">
      <div className="section-heading">
        <h2 id="runtime-heading">Runtimes on this machine</h2>
        <span className="subtle">{available.length} available</span>
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
}
