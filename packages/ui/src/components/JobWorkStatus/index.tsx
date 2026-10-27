import type { Card } from '@pitchcrew/core';
import { Clock3, LoaderCircle } from 'lucide-react';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { stateLabels } from '@/lib/labels.ts';
import { useJobWork } from './hooks/useJobWork.ts';

export const JobWorkStatus = ({ card }: { card: Card }) => {
  const work = useJobWork(card);
  if (!work.label)
    return <span className={`state-pill ${card.state}`}>{stateLabels[card.state]}</span>;
  return (
    <output className="flex items-center gap-1.5 text-xs text-primary" title={work.reason}>
      {work.spinning ? (
        <LoaderCircle size={13} className="spin motion-reduce:animate-none" aria-hidden="true" />
      ) : (
        <Clock3 size={13} aria-hidden="true" />
      )}
      <span>{work.label}</span>
      {work.roleId ? <RoleAvatar agentRole={work.roleId} size="small" /> : null}
    </output>
  );
};
