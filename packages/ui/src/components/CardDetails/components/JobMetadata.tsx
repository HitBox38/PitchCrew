import type { JobMetadataProps } from '@/components/CardDetails/types.ts';
import { ExternalLink, MapPin } from 'lucide-react';

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
    </div>
  );
}
