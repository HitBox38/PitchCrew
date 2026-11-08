import type { Card, Snapshot } from '@pitchcrew/core';
import { useId, type Ref } from 'react';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { useJobWork } from '@/components/JobWorkStatus/hooks/useJobWork.ts';
import { trackIndex } from '../helpers.ts';
import { cardPacketStage } from '../packet-guidance.ts';
import { signalAsks, type JobSignal } from '../signals.ts';
import { cardLine } from '../jobs.ts';
import { StageTrack } from './StageTrack.tsx';

type ClayJobCardProps = {
  card: Card;
  signal: JobSignal;
  data: Snapshot;
  onOpen: (id: string) => void;
  buttonRef?: Ref<HTMLButtonElement>;
};

/**
 * Identity, one 20px line for the decision, live agent activity or named wait, the fit (or a
 * visible "Not scored") and, while in progress, the stage track.
 */
export const ClayJobCard = ({ card, signal, data, onOpen, buttonRef }: ClayJobCardProps) => {
  const fitId = useId();
  const index = trackIndex(card.state);
  const asks = signalAsks(signal);
  const working = !!signal.run && !asks;
  // Requested, queued or held work that has no run yet, shown before the request completes.
  const work = useJobWork(card);
  const waiting = !asks && !signal.run && work.label ? work : null;
  const agent = signal.decision?.roleId ?? signal.run?.roleId;
  const line = cardLine(card, signal, data);
  const progress = index !== null && index >= 2 && index <= 4;
  const spinning = working || !!waiting?.spinning;
  // An agent preparing an approved application is not a wait on the user, and its run is live.
  return (
    <button
      ref={buttonRef}
      type="button"
      className="clay-job-card"
      aria-label={`Open ${card.title} at ${card.company}`}
      aria-describedby={fitId}
      data-asks={asks ? '' : undefined}
      data-working={spinning ? '' : undefined}
      onClick={() => onOpen(card.id)}
    >
      <span className="clay-job-card-company">{card.company}</span>
      <span className="clay-job-card-title">{card.title}</span>
      <span className="clay-job-card-footer">
        {spinning ? (
          <span className="clay-job-spinner" aria-hidden="true" />
        ) : agent ? (
          <RoleAvatar agentRole={agent} size="small" />
        ) : null}
        {waiting ? (
          <output className="clay-job-card-status" title={waiting.reason}>
            {waiting.label}
          </output>
        ) : (
          <span className="clay-job-card-status" title={line.text}>
            {line.text}
          </span>
        )}
        <span
          id={fitId}
          className="clay-job-card-fit"
          data-unscored={card.fit === null ? '' : undefined}
          title={card.fit === null ? 'Scout has not scored the fit yet' : 'Fit'}
        >
          {card.fit === null ? 'Not scored' : <span className="sr-only">Fit </span>}
          {card.fit ?? null}
        </span>
      </span>
      {progress ? (
        <StageTrack
          state={card.state}
          live={!!signal.run && !asks}
          tone={asks ? 'ochre' : undefined}
          stage={cardPacketStage(card, data.approvals)}
        />
      ) : null}
    </button>
  );
};
