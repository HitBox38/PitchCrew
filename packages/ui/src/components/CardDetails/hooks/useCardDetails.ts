import { cardLifecycle } from '@pitchcrew/core/lifecycles';
import { useJobWork } from '@/components/JobWorkStatus/hooks/useJobWork.ts';
import { useNavigate } from '@tanstack/react-router';
import type { ApplicationSection, CardDetailsProps, JobSection } from '../types.ts';
import { applicationRows, jobAgents, jobRole, latestJobFailure } from '../helpers.ts';
import type { Packet } from '@pitchcrew/core';
import { workflowSeat } from '@pitchcrew/core/states';
import { useState } from 'react';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges.ts';
import { packetExported, postSubmissionStates } from '@/lib/job-step.ts';
import { useApplicationBrief } from '@/ApplicationBriefReview/hooks/useApplicationBrief.ts';
import { useExportChoices } from './useExportChoices.ts';

export const useCardDetails = (props: CardDetailsProps) => {
  const { card, data, action, working } = props;
  const navigate = useNavigate();
  const [tab, setTab] = useState<JobSection>(props.initialSection ?? 'job');
  const [briefDirty, setBriefDirty] = useState(false);
  const [activityDirty, setActivityDirty] = useState(false);
  const [editing, setEditing] = useState(false);
  // Comparing the brief with the original posting widens the sheet while Application is open.
  const [comparing, setComparing] = useState(false);
  const guard = useUnsavedChanges(briefDirty || activityDirty);
  const [document, setDocument] = useState<keyof Omit<Packet, 'claims'>>('resume');
  // Untouched (null), Application opens on the current step and follows it as the job moves.
  const [sections, setSections] = useState<ApplicationSection[] | null>(
    props.initialSection === 'application' ? ['brief'] : null,
  );
  const work = useJobWork(card);
  const exportChoices = useExportChoices(card, action);
  const agents = jobAgents(card.id, data);
  const run = agents.find(({ run }) => run.status === 'running')?.run;
  const busy =
    working || Boolean(work.pending) || work.spinning || Boolean(run) || Boolean(card.owner);
  const brief = useApplicationBrief({
    card,
    roles: data.roles,
    busy,
    onDirtyChange: setBriefDirty,
    onInspection: (threadId) =>
      guard.requestLeave(() => {
        props.onClose();
        void navigate({ to: '/chat/$thread', params: { thread: threadId } });
      }),
  });
  const act = (path: string, body?: unknown, success?: string) => {
    if (path === `/cards/${card.id}/run`) {
      const roleId = (body as { roleId: string }).roleId;
      const seat = workflowSeat(data.roles.find((r) => r.id === roleId)!);
      void action(
        '/queue/actions',
        'POST',
        {
          cardId: card.id,
          roleId,
          action: seat === 'scout' ? 'fit' : seat === 'writer' ? 'draft' : 'review',
        },
        'Crew action queued',
      ).catch(() => {});
    } else void action(path, 'POST', body, success).catch(() => {});
  };
  const exported = packetExported(card, data.approvals);
  const current = postSubmissionStates.has(card.state)
    ? undefined
    : applicationRows(card, brief.confirmed, exported).find((row) => !row.done)?.id;
  // While revising, Reviews (what Reviewer asked for) opens beside the documents to change.
  const revising = card.state === 'changes_requested' && Boolean(card.packet);
  const openSections =
    sections ?? (current ? (revising ? [current, 'reviews' as const] : [current]) : []);
  const openApplication = (section: ApplicationSection) => {
    setTab('application');
    setSections((list) => {
      const open = list ?? openSections;
      return open.includes(section) ? open : [...open, section];
    });
    requestAnimationFrame(() => documentElement(section)?.focus());
  };
  const seat =
    card.state === 'lead'
      ? 'scout'
      : cardLifecycle.is('draftable', card.state)
        ? 'writer'
        : 'reviewer';
  const runRole = seat === 'writer' ? brief.roleId : jobRole(data, seat)?.id;
  return {
    ...props,
    work,
    tab,
    setTab,
    document,
    setDocument,
    brief,
    exportChoices,
    sections: openSections,
    setSections,
    openApplication,
    setActivityDirty,
    guard,
    agents,
    run,
    busy,
    editing,
    setEditing,
    comparing: comparing && tab === 'application',
    setComparing,
    editBlocker: busy
      ? 'Finish active job work before editing.'
      : card.submissionAttempts?.some((attempt) => attempt.status === 'uncertain')
        ? 'Resolve the uncertain submission before editing.'
        : briefDirty || activityDirty
          ? 'Save or discard your other job edits first.'
          : '',
    act,
    exported,
    runRole,
    failed: latestJobFailure(card.id, data.runs),
    onClose: () => guard.requestLeave(props.onClose),
    openInbox: () => guard.requestLeave(props.onInbox),
    openQueue: () =>
      guard.requestLeave(() => {
        props.onClose();
        void navigate({ to: '/queue' });
      }),
    openWriting: () =>
      guard.requestLeave(() => {
        props.onClose();
        void navigate({ to: '/settings', search: { section: 'writing' } });
      }),
    openChat: (thread: string, runId: string) =>
      guard.requestLeave(() => props.onChat(thread, runId)),
  };
};
const documentElement = (section: ApplicationSection) => {
  return document.getElementById(`job-section-${section}`);
};
