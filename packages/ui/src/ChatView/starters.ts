import type { ConversationWelcomeProps } from './types.ts';

const rolePurpose: Record<string, string> = {
  scout: 'Find the right opportunities',
  writer: 'Write a stronger application',
  reviewer: 'Check the details',
  'career-coach': 'Prepare for your next career step',
};

const conversationStarters: Record<string, { label: string; prompt: string }[]> = {
  'career-coach': [
    {
      label: 'Research a company',
      prompt:
        'Research a company for me and prepare a sourced brief covering its business, relevant team, recent developments, interview process and material concerns. Ask which company if it is not clear from context.',
    },
    {
      label: 'Improve my LinkedIn',
      prompt:
        'Help me improve my LinkedIn profile for my target role family. Use my Profile and ask for current sections or essential missing context. Show section-by-section drafts, explanations and measured length checks for me to review and publish myself.',
    },
    {
      label: 'Prepare for an interview',
      prompt:
        'Help me prepare for an interview, using the job context if available. Ask for any essential missing details.',
    },
    {
      label: 'Practice with me',
      prompt:
        'Practice an interview with me, one question at a time. Use coached feedback unless I ask for a mock interview.',
    },
    {
      label: 'Debrief an interview',
      prompt:
        'Help me debrief an interview: what was asked, how I answered and what to prepare next.',
    },
    {
      label: 'Plan my career',
      prompt:
        'Help me explore career directions, adjacent roles and learning priorities based on my goals and Profile.',
    },
    {
      label: 'Evaluate an offer',
      prompt:
        'Help me understand and compare an employment offer, including its compensation and contract terms. Ask me for the offer and my priorities.',
    },
  ],
  scout: [
    {
      label: 'Research a company',
      prompt:
        'Research a company for me and prepare a sourced brief covering its business, relevant team, recent developments, interview process and material concerns. Ask which company if it is not clear from context.',
    },
    {
      label: 'What should I look for?',
      prompt: 'Help me define what to look for in my next role, using my profile.',
    },
    {
      label: 'Evaluate this job',
      prompt: 'Evaluate this attached job against my profile and explain the fit.',
    },
  ],
  writer: [
    {
      label: 'Shape my application',
      prompt: 'Help me shape a compelling application for this attached job, based on my profile.',
    },
    {
      label: 'Improve my story',
      prompt: 'How can I explain my experience more clearly in applications?',
    },
  ],
  reviewer: [
    {
      label: 'Review this packet',
      prompt: 'Review the packet for this attached job and explain what needs improving.',
    },
    {
      label: 'Explain your checks',
      prompt: 'What do you check before an application packet is ready?',
    },
  ],
};

/** The empty conversation's one purpose line. */
export const welcomeLine = ({
  roleId,
  role,
  conversation,
  readOnly,
}: Pick<ConversationWelcomeProps, 'roleId' | 'role' | 'conversation' | 'readOnly'>) => {
  if (readOnly) return 'Saved exchanges appear here. Start a separate conversation to join in.';
  if ((conversation?.participants.length ?? 1) > 1)
    return 'Ask the group, or @mention an agent to direct your request. The lead coordinates.';
  return `${role.name}: ${rolePurpose[roleId] ?? role.description}`;
};

/** Role starters that fit this conversation, then a general question about the role. */
export const welcomeStarters = ({
  roleId,
  attached,
  conversation,
}: Pick<ConversationWelcomeProps, 'roleId' | 'attached' | 'conversation'>) => {
  if ((conversation?.participants.length ?? 1) > 1)
    return [
      {
        label: 'How does the crew work?',
        prompt:
          'Explain how the crew can help me take an application from evaluation through review.',
      },
    ];
  return [
    ...(conversationStarters[roleId] ?? []).filter(
      (starter) => attached || !starter.prompt.includes('attached job'),
    ),
    {
      label: 'Ask about this role',
      prompt: 'What can you help me with, and how do you work with the other agents?',
    },
  ];
};
