'use client';

import { BriefcaseBusiness } from 'lucide-react';
import { Message } from '@/components/ai-elements/message/components/Message.tsx';
import { MessageContent } from '@/components/ai-elements/message/components/MessageContent.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { job, reply, request } from '../constants';
import { DemoTurn } from './DemoTurn';

const JobLink = () => {
  return (
    <span className="chat-job-link">
      <BriefcaseBusiness size={12} aria-hidden="true" /> {job}
    </span>
  );
};

export const ChatDemo = () => {
  return (
    <div className="chat-workspace writer chat-demo">
      <header className="chat-demo-header">
        <RoleAvatar agentRole="writer" />
        <span className="min-w-0 flex-1">
          <strong>Writer chat</strong>
          <span>Writer · Ready</span>
        </span>
        <span className="chat-demo-label">Fictional conversation</span>
      </header>
      <div className="chat-demo-transcript">
        <Message from="user" className="chat-message">
          <div className={meta}>
            <strong>You</strong>
            <span>2 min ago</span>
          </div>
          <MessageContent className="chat-message-content">
            <p>{request}</p>
          </MessageContent>
          <JobLink />
        </Message>
        <DemoTurn />
        <Message from="assistant" className="chat-message">
          <div className={meta}>
            <RoleAvatar agentRole="writer" size="small" />
            <strong>Writer</strong>
            <span>Just now</span>
          </div>
          <MessageContent className="chat-message-content">
            {reply.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </MessageContent>
          <JobLink />
        </Message>
      </div>
    </div>
  );
};

const meta = 'chat-message-meta flex items-center gap-2 text-detail text-muted-foreground';
