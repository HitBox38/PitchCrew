import { CompanyMark } from '@/components/CompanyMark/index.tsx';
import { useJobCard } from '@/components/JobCard/hooks/useJobCard.ts';
import type { JobCardProps } from '@/components/JobCard/types.ts';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { stateLabels } from '@/lib/labels.ts';
import { LoaderCircle } from 'lucide-react';
import * as m from 'motion/react-m';

export function JobCard(props: JobCardProps) {
  const controller = useJobCard(props);
  const { card, onOpen, reduced, tiltX, tiltY, rotateX, rotateY } = controller;
  return (
    <Button
      render={
        <m.button
          layout="position"
          layoutId={`job-${card.id}`}
          initial={reduced ? false : { opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: reduced ? 1 : 0.97 }}
          whileHover={reduced ? undefined : { y: -4 }}
          whileTap={reduced ? undefined : { y: 0, scale: 0.985 }}
          style={{
            rotateX: reduced ? 0 : rotateX,
            rotateY: reduced ? 0 : rotateY,
            transformPerspective: 900,
          }}
          onPointerMove={(event) => {
            if (reduced || event.pointerType !== 'mouse') return;
            const rect = event.currentTarget.getBoundingClientRect();
            tiltX.set((0.5 - (event.clientY - rect.top) / rect.height) * 4);
            tiltY.set(((event.clientX - rect.left) / rect.width - 0.5) * 4);
          }}
          onPointerLeave={() => {
            tiltX.set(0);
            tiltY.set(0);
          }}
        />
      }
      className="job-card"
      onClick={onOpen}
      aria-label={`Open ${card.title} at ${card.company}`}
    >
      <div className="job-top">
        <CompanyMark name={card.company} />
        <strong>{card.company}</strong>
        {card.sample ? <span className="sample-tag">example</span> : null}
      </div>
      <h3>{card.title}</h3>
      <p className="job-location">
        {card.location || 'Location not given'}
        {card.salary ? <span> · {card.salary}</span> : null}
      </p>
      {card.tags.length ? (
        <div className="tags">
          {card.tags.slice(0, 3).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
      <div className="job-bottom">
        {card.fit !== null ? (
          <span className={`fit ${card.fit >= 80 ? 'high' : ''}`}>
            <span className="fit-meter" aria-hidden="true">
              <span style={{ width: `${card.fit}%` }} />
            </span>
            {card.fit}% fit
          </span>
        ) : (
          <span className="subtle">Not scored</span>
        )}
        {card.owner ? (
          <span className="owner">
            <LoaderCircle size={13} className="spin" />
            <RoleAvatar agentRole={card.owner} size="small" />
          </span>
        ) : (
          <span className={`state-pill ${card.state}`}>{stateLabels[card.state]}</span>
        )}
      </div>
    </Button>
  );
}
