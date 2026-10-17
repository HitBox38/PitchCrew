import { Message } from '@/components/ai-elements/message/components/Message.tsx';
import * as m from 'motion/react-m';

export const AnimatedMessage = m.create(Message);

export const rolePurpose: Record<string, string> = {
  scout: 'Find the right opportunities',
  writer: 'Write a stronger application',
  reviewer: 'Check the details',
  'career-coach': 'Prepare for your next career step',
};

export const conversationStarters: Record<string, { label: string; prompt: string }[]> = {
  'career-coach': [
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
