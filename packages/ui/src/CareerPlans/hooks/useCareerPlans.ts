import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { CareerPlan, Conversation } from '@pitchcrew/core';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

export const useCareerPlans = () => {
  const discuss = async (plan: CareerPlan) => {
    const thread = (await action('/conversations', 'POST', {
      title: `Career plan: ${plan.name}`.slice(0, 120),
      participants: [coach!.id],
    })) as Conversation;
    await action(`/conversations/${thread.id}/messages`, 'POST', {
      content: `Review career action plan ${plan.id} (${plan.name}). Read it with pitchcrew_application_quality plans_read. Analyze only its chosen scope, cite actual job requirements, distinguish missing evidence from confirmed skill gaps and application coverage gaps, and save a refreshed analysis. Rank a few practical next steps by required/preferred importance, recurrence, my goals and available time; explain unknowns. Preserve my active priorities and progress.`,
      intent: 'queue',
    });
    await navigate({ to: '/chat/$thread', params: { thread: thread.id } });
  };

  const plans = useWorkspaceStore((s) => s.data?.quality?.careerPlans ?? []);
  const roles = useWorkspaceStore((s) => s.data?.roles ?? []);
  const action = useWorkspaceStore((s) => s.action);
  const working = useWorkspaceStore((s) => s.working);
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const change = (data: Record<string, unknown>) =>
    action('/quality', 'POST', data, 'Career plan updated');
  const coach = roles.find((r) => r.id === 'career-coach' && !r.retiredAt);
  return { plans, coach, working, creating, setCreating, change, discuss };
};
