import { Message } from '@/components/ai-elements/message/components/Message.tsx';
import * as m from 'motion/react-m';

export const AnimatedMessage = m.create(Message);

export const rolePurpose = {
  scout: 'Find the right opportunities',
  writer: 'Write a stronger application',
  reviewer: 'Check the details',
};

export const conversationStarters = {
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
