import type { JobMetadataProps } from '@/components/CardDetails/types.ts';
import { jobProviderLabels } from '@/lib/labels.ts';
import { ExternalLink, MapPin, Radar } from 'lucide-react';

export function JobMetadata({ card }: JobMetadataProps) {
  return (
    <div className="detail-meta">
      <span>
        <MapPin size={14} />
        {card.location}
      </span>
      {card.salary ? <span>{card.salary}</span> : null}
      {card.url ? (
        <a href={card.url} target="_blank" rel="noreferrer">
          Job post <ExternalLink size={13} />
        </a>
      ) : null}
      {card.discovery ? (
        <span title={`Job ID ${card.discovery.jobId}`}>
          <Radar size={14} />
          Found on {jobProviderLabels[card.discovery.provider]} ({card.discovery.sourceName}){' '}
          {new Date(card.discovery.firstSeenAt).toLocaleDateString()}
        </span>
      ) : null}
    </div>
  );
}
