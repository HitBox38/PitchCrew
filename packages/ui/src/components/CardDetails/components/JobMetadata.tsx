import type { JobMetadataProps } from '@/components/CardDetails/types.ts';
import { ExternalLink, MapPin, Radar } from 'lucide-react';

const providers = { greenhouse: 'Greenhouse', ashby: 'Ashby', lever: 'Lever' } as const;

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
          Found on {providers[card.discovery.provider]} ({card.discovery.sourceName}){' '}
          {new Date(card.discovery.firstSeenAt).toLocaleDateString()}
        </span>
      ) : null}
    </div>
  );
}
