import { useJobWork } from '@/components/JobWorkStatus/hooks/useJobWork.ts';
import { useNavigate } from '@tanstack/react-router';
import type { ApplicationSection, CardDetailsProps, JobSection } from '../types.ts';
import { jobAgents, jobRole, latestJobFailure } from '../helpers.ts';
import type { Packet } from '@pitchcrew/core';
import { workflowSeat } from '@pitchcrew/core/states';
import { useState } from 'react';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges.ts';
import { useApplicationBrief } from '@/ApplicationBriefReview/hooks/useApplicationBrief.ts';

export const useCardDetails = (props: CardDetailsProps) => {
  const { card, data, action, working } = props;
  const navigate = useNavigate();
  const [tab, setTab] = useState<JobSection>(props.initialSection ?? 'job');
  const [briefDirty, setBriefDirty] = useState(false);
  const [activityDirty, setActivityDirty] = useState(false);
  const [editing, setEditing] = useState(false);
  const guard = useUnsavedChanges(briefDirty || activityDirty);
  const [document, setDocument] = useState<keyof Omit<Packet, 'claims'>>('resume');
  const [sections, setSections] = useState<ApplicationSection[]>(
    props.initialSection === 'application' ? ['brief'] : [],
  );
  const work = useJobWork(card);
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
  const openApplication = (section: ApplicationSection) => {
    setTab('application');
    setSections((current) => (current.includes(section) ? current : [...current, section]));
    requestAnimationFrame(() => documentElement(section)?.focus());
  };
  const exported = data.approvals.some(
    (approval) =>
      approval.cardId === card.id &&
      approval.status === 'consumed' &&
      approval.exportDirectory &&
      JSON.stringify(approval.packet) === JSON.stringify(card.packet),
  );
  const seat =
    card.state === 'lead'
      ? 'scout'
      : ['shortlisted', 'changes_requested'].includes(card.state)
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
    sections,
    setSections,
    openApplication,
    setActivityDirty,
    guard,
    agents,
    run,
    busy,
    editing,
    setEditing,
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
