import type { Card, Role } from '@pitchcrew/core';
import type { Ref } from 'react';
import { runActivityLabel } from '@/lib/work-queue.ts';
import { trackIndex } from '../helpers.ts';
import type { JobSignal } from '../signals.ts';
import { jobStatus } from '../jobs.ts';
import { StageTrack } from './StageTrack.tsx';

type ClayJobCardProps = {
  card: Card;
  signal: JobSignal;
  roles: Role[];
  onOpen: (id: string) => void;
  buttonRef?: Ref<HTMLButtonElement>;
};

export const ClayJobCard = ({ card, signal, roles, onOpen, buttonRef }: ClayJobCardProps) => {
  const index = trackIndex(card.state);
  const working = signal.run && !signal.decision;
  const footer = signal.decision
    ? jobStatus(card, signal, roles)
    : signal.run
      ? `${roles.find((role) => role.id === signal.run?.roleId)?.name ?? 'Agent'} · ${runActivityLabel(signal.run)}`
      : card.location || '';
  return (
    <button
      ref={buttonRef}
      type="button"
      className="clay-job-card"
      aria-label={`Open ${card.title} at ${card.company}`}
      data-asks={signal.decision ? '' : undefined}
      data-working={working ? '' : undefined}
      onClick={() => onOpen(card.id)}
    >
      <span className="clay-job-card-company">{card.company}</span>
      <span className="clay-job-card-title">{card.title}</span>
      <span className="clay-job-card-footer">
        {working ? <span className="clay-job-spinner" aria-hidden="true" /> : null}
        <span className="clay-job-card-status">{footer}</span>
        <span className="clay-job-card-fit">{card.fit ?? '–'}</span>
      </span>
      {index !== null && index >= 2 && index <= 4 ? (
        <StageTrack
          state={card.state}
          live={!!working}
          tone={signal.decision || index === 4 ? 'ochre' : 'plum'}
        />
      ) : null}
    </button>
  );
};
