import { useRef, useState } from 'react';
import {
  ArrowRight,
  BriefcaseBusiness,
  GitBranch,
  HardDrive,
  LoaderCircle,
  MessageSquare,
  Send,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import type { ChatMessage, RoleId, Snapshot } from '@pitchcrew/core';
import type { Action } from './App.tsx';
import { RoleAvatar, runtimeLabels, stateLabels, timeAgo } from './components.tsx';
import { Fragment } from 'react';
import { ChatWork } from './chat-work.tsx';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select.tsx';
import { Button } from './components/ui/button.tsx';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from './components/ai-elements/conversation.tsx';
import { Message, MessageContent, MessageResponse } from './components/ai-elements/message.tsx';
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from './components/ai-elements/prompt-input.tsx';

export type ChatThread = RoleId | 'crew';
const rolePurpose = {
  scout: 'Find the right opportunities',
  writer: 'Write a stronger application',
  reviewer: 'Check the details',
};
const conversationStarters = {
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
function messageDay(date: string) {
  const value = new Date(date);
  if (value.toDateString() === new Date().toDateString()) return 'Today';
  return value.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: value.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}
const noRemoteImages = { img: ({ alt }: { alt?: string }) => <span>{alt || 'Image'}</span> };
export function ChatView({
  data,
  thread,
  onThread,
  onConfigure,
  onOpenCard,
  action,
  working,
}: {
  data: Snapshot;
  thread: ChatThread;
  onThread: (thread: ChatThread) => void;
  onConfigure: (id: RoleId) => void;
  onOpenCard: (id: string) => void;
  action: Action;
  working: boolean;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [drafts, setDrafts] = useState<Partial<Record<ChatThread, string>>>({});
  const [jobs, setJobs] = useState<Partial<Record<ChatThread, string>>>({});
  const [recipient, setRecipient] = useState<RoleId>('scout');
  const [panes, setPanes] = useState<Partial<Record<ChatThread, 'conversation' | 'work'>>>({});
  const pane = panes[thread] ?? 'conversation';
  const setPane = (next: 'conversation' | 'work') =>
    setPanes((current) => ({ ...current, [thread]: next }));
  const [error, setError] = useState('');
  const roleId = thread === 'crew' ? recipient : thread;
  const role = data.roles.find((r) => r.id === roleId)!;
  const streamingIds = new Set(data.streamingMessages.map((message) => message.id));
  const messages = [...data.messages, ...data.streamingMessages].filter(
    (m) => m.threadId === thread,
  );
  const running = data.runs.filter(
    (r) => r.status === 'running' && (thread === 'crew' || r.roleId === roleId),
  );
  const busy = data.runs.some((r) => r.roleId === roleId && r.status === 'running');
  const available = data.runtimes.some((r) => r.id === role.runtime && r.available);
  const draft = drafts[thread] ?? '';
  const cardId = jobs[thread] ?? '';
  const proposals = data.proposals.filter(
    (p) => (thread === 'crew' || p.roleId === thread) && p.status === 'pending',
  );
  const tasks = data.tasks
    .filter((t) => thread === 'crew' || t.roleId === thread)
    .slice(-12)
    .reverse();
  const attention =
    proposals.length + tasks.filter((task) => ['queued', 'running'].includes(task.status)).length;
  const jobItems = [
    { value: '', label: 'Attach a job' },
    ...data.cards.map((card) => ({ value: card.id, label: `${card.company} · ${card.title}` })),
  ];
  const recipientItems = data.roles.map((item) => ({ value: item.id, label: item.name }));
  const attached = data.cards.find((card) => card.id === cardId);
  const roleState = !role.enabled
    ? 'Paused'
    : !available
      ? 'Unavailable'
      : busy
        ? 'Working'
        : 'Ready';
  const name = (id: ChatMessage['from'] | ChatMessage['to']) =>
    id === 'user'
      ? 'You'
      : id === 'crew'
        ? 'Crew'
        : id === 'system'
          ? 'Pitchcrew'
          : (data.roles.find((r) => r.id === id)?.name ?? id);
  const useStarter = (prompt: string) => {
    setDrafts((current) => ({ ...current, [thread]: prompt }));
    inputRef.current?.focus();
  };
  async function send(text: string) {
    if (!text.trim() || busy || working || !role.enabled || !available) return;
    const sentThread = thread;
    setPane('conversation');
    setError('');
    try {
      await action(`/roles/${roleId}/chat`, 'POST', {
        content: text,
        cardId: cardId || null,
        threadId: thread,
      });
      setDrafts((current) => ({ ...current, [sentThread]: '' }));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not send your message.');
    }
  }

  return (
    <section className={`chat-workspace ${thread}`} aria-label="Agent conversations">
      <nav className="chat-rail" aria-label="Conversations">
        <div className="chat-rail-heading">
          <h2>Conversations</h2>
          <span>{data.roles.length} roles</span>
        </div>
        {data.roles.map((item) => {
          const latest = data.messages.findLast((m) => m.threadId === item.id);
          const reviewCount = data.proposals.filter(
            (proposal) => proposal.roleId === item.id && proposal.status === 'pending',
          ).length;
          const active = data.runs.some((r) => r.roleId === item.id && r.status === 'running');
          return (
            <Button
              key={item.id}
              variant="ghost"
              className={`chat-thread ${thread === item.id ? 'selected' : ''}`}
              aria-current={thread === item.id ? 'page' : undefined}
              onClick={() => {
                onThread(item.id);
                setError('');
              }}
            >
              <RoleAvatar agentRole={item.id} size="normal" />
              <span className="chat-thread-copy">
                <strong>
                  {item.name}
                  {reviewCount ? (
                    <span className="chat-count" title={`${reviewCount} proposed changes`}>
                      {reviewCount}
                    </span>
                  ) : null}
                  <span
                    className={`chat-role-dot ${active ? 'working' : !item.enabled ? 'paused' : ''}`}
                    title={active ? 'Working' : item.enabled ? 'Enabled' : 'Paused'}
                  />
                </strong>
                <small>
                  {active
                    ? 'Working…'
                    : latest
                      ? `${latest.from === 'user' ? 'You: ' : ''}${latest.content}`
                      : rolePurpose[item.id]}
                </small>
              </span>
            </Button>
          );
        })}
        <div className="chat-rail-divider" />
        <Button
          variant="ghost"
          className={`chat-thread ${thread === 'crew' ? 'selected' : ''}`}
          aria-current={thread === 'crew' ? 'page' : undefined}
          onClick={() => {
            onThread('crew');
            setError('');
          }}
        >
          <span className="crew-chat-icon">
            <Users size={19} />
          </span>
          <span className="chat-thread-copy">
            <strong>Crew conversation</strong>
            <small>Shared messages and handoffs</small>
          </span>
        </Button>
        <div className="chat-rail-note">
          <HardDrive size={14} />
          <span>Saved on this device</span>
        </div>
      </nav>
      <div className="chat-panel">
        <header className="chat-heading">
          {thread === 'crew' ? (
            <span className="crew-chat-icon">
              <Users size={22} />
            </span>
          ) : (
            <RoleAvatar agentRole={roleId} size="large" />
          )}
          <div>
            <h2>{thread === 'crew' ? 'Crew conversation' : role.name}</h2>
            <p>
              {thread === 'crew'
                ? 'Follow the crew’s work and join the conversation.'
                : role.description}
            </p>
          </div>
          <div className="chat-heading-actions">
            <span className={`chat-role-state ${roleState.toLowerCase()}`}>
              <span className="chat-role-dot" />
              {thread === 'crew'
                ? running.length
                  ? `${running.length} working`
                  : `${data.roles.length} roles`
                : roleState}
            </span>
            <Button
              variant="ghost"
              className="chat-runtime"
              onClick={() => onConfigure(roleId)}
              title={
                role.runtime === 'demo'
                  ? 'Demo replies are scripted. Choose Claude Code or Codex for AI conversations.'
                  : `Change ${role.name}’s runtime`
              }
            >
              {runtimeLabels[role.runtime]}
              {role.runtime === 'demo' ? <span>Scripted</span> : null}
            </Button>
            <Button
              variant="ghost"
              className="chat-settings"
              aria-label={`Configure ${role.name}`}
              onClick={() => onConfigure(roleId)}
            >
              <SlidersHorizontal size={16} />
              <span>Settings</span>
            </Button>
          </div>
        </header>
        <Tabs
          value={pane}
          onValueChange={(value) => setPane(value as 'conversation' | 'work')}
          className="chat-body-tabs"
        >
          <TabsList variant="line" className="chat-tabs" aria-label="Conversation view">
            <TabsTrigger value="conversation">
              <MessageSquare size={15} /> Conversation
            </TabsTrigger>
            <TabsTrigger value="work">
              <GitBranch size={15} /> Crew work
              {attention ? <span className="chat-count">{attention}</span> : null}
            </TabsTrigger>
          </TabsList>
          {pane === 'conversation' ? (
            <TabsContent value="conversation" className="chat-conversation-panel">
              <Conversation
                key={thread}
                className="chat-conversation"
                aria-label={`${thread === 'crew' ? 'Crew' : role.name} messages`}
              >
                <ConversationContent className="chat-transcript">
                  {!messages.length ? (
                    <ConversationEmptyState className="chat-empty">
                      <div className="chat-empty-identity">
                        {thread === 'crew' ? (
                          <span className="crew-chat-icon">
                            <Users size={30} />
                          </span>
                        ) : (
                          <RoleAvatar agentRole={roleId} size="large" />
                        )}
                      </div>
                      <h3>{thread === 'crew' ? 'Bring the crew together' : rolePurpose[roleId]}</h3>
                      <p>
                        {thread === 'crew'
                          ? 'Follow the handoffs, ask a question, or help the crew decide what comes next.'
                          : `${role.description} Start with a question, or attach a job to work on an application.`}
                      </p>
                      <div className="chat-starters">
                        {thread === 'crew' ? (
                          <Button
                            className="chat-starter"
                            variant="outline"
                            onClick={() =>
                              useStarter(
                                'Explain how the crew can help me take an application from evaluation through review.',
                              )
                            }
                          >
                            <span>How does the crew work?</span>
                            <ArrowRight size={15} />
                          </Button>
                        ) : (
                          <>
                            <Button
                              className="chat-starter"
                              variant="outline"
                              onClick={() =>
                                useStarter(
                                  'What can you help me with, and how do you work with the other agents?',
                                )
                              }
                            >
                              <span>Ask about this role</span>
                              <ArrowRight size={15} />
                            </Button>
                            {conversationStarters[roleId]
                              .filter(
                                (starter) => attached || !starter.prompt.includes('attached job'),
                              )
                              .map((starter) => (
                                <Button
                                  className="chat-starter"
                                  variant="outline"
                                  key={starter.label}
                                  onClick={() => useStarter(starter.prompt)}
                                >
                                  <span>{starter.label}</span>
                                  <ArrowRight size={15} />
                                </Button>
                              ))}
                          </>
                        )}
                      </div>
                    </ConversationEmptyState>
                  ) : null}
                  {messages.map((message, index) => {
                    const job = data.cards.find((c) => c.id === message.cardId);
                    const streaming = streamingIds.has(message.id);
                    return (
                      <Fragment key={message.id}>
                        {index === 0 ||
                        new Date(messages[index - 1].createdAt).toDateString() !==
                          new Date(message.createdAt).toDateString() ? (
                          <div className="chat-day">
                            <span>{messageDay(message.createdAt)}</span>
                          </div>
                        ) : null}
                        <Message
                          from={message.from === 'user' ? 'user' : 'assistant'}
                          className={`chat-message ${message.from === 'system' ? 'chat-system' : ''}`}
                        >
                          <div className="chat-message-meta">
                            {message.from !== 'user' && message.from !== 'system' ? (
                              <RoleAvatar agentRole={message.from} size="small" />
                            ) : null}
                            <strong>{name(message.from)}</strong>
                            {thread === 'crew' && message.to !== 'crew' ? (
                              <span className="chat-route">
                                <ArrowRight size={12} /> {name(message.to)}
                              </span>
                            ) : null}
                            <time
                              dateTime={message.createdAt}
                              title={new Date(message.createdAt).toLocaleString()}
                            >
                              {timeAgo(message.createdAt)}
                            </time>
                          </div>
                          <MessageContent className="chat-message-content" aria-busy={streaming}>
                            <MessageResponse
                              mode={streaming ? 'streaming' : 'static'}
                              isAnimating={streaming}
                              components={noRemoteImages}
                            >
                              {message.content}
                            </MessageResponse>
                          </MessageContent>
                          {streaming ? (
                            <span className="chat-stream-status">
                              <LoaderCircle size={12} className="spin" /> Replying…
                            </span>
                          ) : null}
                          {job ? (
                            <Button
                              variant="ghost"
                              className="chat-job-link"
                              onClick={() => onOpenCard(job.id)}
                            >
                              <BriefcaseBusiness size={12} /> {job.company} · {job.title}
                            </Button>
                          ) : null}
                        </Message>
                      </Fragment>
                    );
                  })}
                </ConversationContent>
                <ConversationScrollButton className="button chat-scroll" />
              </Conversation>
            </TabsContent>
          ) : null}
          {pane === 'work' ? (
            <TabsContent value="work" className="chat-work-panel">
              <ChatWork
                data={data}
                thread={thread}
                role={role}
                proposals={proposals}
                tasks={tasks}
                action={action}
                working={working}
                onConfigure={() => onConfigure(roleId)}
                onOpenCard={onOpenCard}
              />
            </TabsContent>
          ) : null}
        </Tabs>
        {running.length ? (
          <output className="chat-progress">
            <LoaderCircle size={15} className="spin" />
            <span>{running.map((r) => `${name(r.roleId)}: ${r.message}`).join(' · ')}</span>
            <Button
              className="text-button"
              disabled={working}
              onClick={() => {
                void (async () => {
                  for (const run of running) await action(`/runs/${run.id}/cancel`).catch(() => {});
                })();
              }}
            >
              Stop
            </Button>
          </output>
        ) : null}
        <div className="chat-compose">
          {!role.enabled || !available ? (
            <p className="form-error">
              {!role.enabled
                ? `${role.name} is paused. Enable this role in its settings to chat.`
                : `${runtimeLabels[role.runtime]} is not available. Choose an installed runtime in role settings.`}
            </p>
          ) : null}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <PromptInput onSubmit={({ text }) => send(text)} className="chat-prompt">
            <PromptInputBody>
              <PromptInputTextarea
                ref={inputRef}
                aria-label={`Message ${role.name}`}
                placeholder={busy ? `${role.name} is working…` : `Message ${role.name}…`}
                value={draft}
                onChange={(e) => setDrafts((current) => ({ ...current, [thread]: e.target.value }))}
                disabled={busy || working || !role.enabled || !available}
                maxLength={8000}
                className="chat-textarea"
              />
            </PromptInputBody>
            <PromptInputFooter className="chat-prompt-footer">
              <PromptInputTools className="chat-context-tools">
                {thread === 'crew' ? (
                  <Select
                    value={recipient}
                    items={recipientItems}
                    disabled={working}
                    onValueChange={(value: RoleId | null) => {
                      if (value) setRecipient(value);
                    }}
                  >
                    <SelectTrigger
                      className="chat-context-select chat-recipient-select"
                      aria-label="Message recipient"
                      size="sm"
                    >
                      <span className="chat-select-prefix">To</span>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="top" align="start" alignItemWithTrigger={false}>
                      {recipientItems.map((item) => (
                        <SelectItem value={item.value} key={item.value}>
                          <RoleAvatar agentRole={item.value} size="small" />
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                <Select
                  value={cardId}
                  items={jobItems}
                  disabled={busy || working}
                  onValueChange={(value: string | null) => {
                    if (value !== null) setJobs((current) => ({ ...current, [thread]: value }));
                  }}
                >
                  <SelectTrigger
                    className={`chat-context-select chat-job-select ${attached ? 'attached' : ''}`}
                    aria-label="Attach job context"
                    size="sm"
                  >
                    <BriefcaseBusiness size={14} />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    side="top"
                    align="start"
                    alignItemWithTrigger={false}
                    className="chat-job-menu"
                  >
                    {jobItems.map((item) => (
                      <SelectItem value={item.value} key={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {attached ? (
                  <Button
                    className="chat-attached-state"
                    variant="ghost"
                    onClick={() => onOpenCard(attached.id)}
                  >
                    {stateLabels[attached.state]}
                    <ArrowRight size={12} />
                  </Button>
                ) : null}
              </PromptInputTools>
              <PromptInputSubmit
                className="button primary chat-send"
                aria-label="Send message"
                status={working ? 'submitted' : 'ready'}
                disabled={!draft.trim() || busy || working || !role.enabled || !available}
              >
                <Send size={15} />
                <span>Send</span>
              </PromptInputSubmit>
            </PromptInputFooter>
          </PromptInput>
          <p className="chat-compose-hint">
            <span>
              Enter to send <span aria-hidden="true">·</span> Shift + Enter for a new line
            </span>
            <span>
              {role.runtime === 'demo' ? 'Demo replies are scripted' : 'Saved on this device'}
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
