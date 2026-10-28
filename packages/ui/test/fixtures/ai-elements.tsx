import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { ServiceCommand } from '@/BackgroundServiceSettings/components/ServiceCommand.tsx';
import { BrowserActionSummary } from '@/ComputerApprovals/components/BrowserActionSummary.tsx';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ChatMessage, Snapshot, RunActivity, ChatRequest } from '@pitchcrew/core';
import { AppMotion } from '@/AppMotion/index.tsx';
import { ConversationHistory } from '@/ChatView/components/ConversationHistory.tsx';
import { ConversationQueue } from '@/ChatView/components/ConversationQueue.tsx';
import { ActivityGroup } from '@/ChatTurn/components/ActivityGroup.tsx';
import { ComposerAttachments } from '@/ChatView/components/ComposerAttachments.tsx';
import { Suggestion } from '@/components/ai-elements/suggestion/index.tsx';
import { PromptInput } from '@/components/ai-elements/prompt-input/components/PromptInput.tsx';
import { PromptInputTextarea } from '@/components/ai-elements/prompt-input/components/PromptInputTextarea.tsx';
import { PromptInputSubmit } from '@/components/ai-elements/prompt-input/components/PromptInputSubmit.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Notifications } from '@/Notifications/index.tsx';
import { LinkConfirmation } from '@/components/MarkdownContent/components/LinkConfirmation.tsx';
import '@/styles.css';

const Fixture = () => {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState([new File(['fictional'], 'resume.txt')]);
  const [submitted, setSubmitted] = useState('');
  const [fail, setFail] = useState(true);
  const [attempts, setAttempts] = useState(0);
  const [queueAction, setQueueAction] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [unsafeLinkOpen, setUnsafeLinkOpen] = useState(false);
  const [unsafeLinkOpened, setUnsafeLinkOpened] = useState(false);
  return (
    <AppMotion>
      <Notifications />
      <Button onClick={() => setUnsafeLinkOpen(true)}>Preview blocked link</Button>
      <output aria-label="Unsafe link opened">{String(unsafeLinkOpened)}</output>
      <LinkConfirmation
        url="file:///pitchcrew-fictional-blocked-link"
        isOpen={unsafeLinkOpen}
        onClose={() => setUnsafeLinkOpen(false)}
        onConfirm={() => setUnsafeLinkOpened(true)}
      />
      <div className="chat-workspace" style={{ maxWidth: 820, margin: 'auto' }}>
        <Button
          onClick={() =>
            setMessages((previous) => [
              ...previous,
              {
                ...initial[60],
                id: `message-${previous.length}`,
                content: `New reply ${previous.length}\n\n${'Streamed reply.\n\n'.repeat(12)}`,
                createdAt: new Date(Date.UTC(2026, 9, 1, 0, previous.length)).toISOString(),
              },
            ])
          }
        >
          Append reply
        </Button>
        <Button
          onClick={() => {
            setStreaming(true);
            setMessages((previous) =>
              previous.map((message) =>
                message.id === 'message-60'
                  ? { ...message, content: '```js\nconst streaming = "<safe>";\n' }
                  : message,
              ),
            );
          }}
        >
          Stream code
        </Button>
        <div style={{ height: 420, display: 'flex', flexDirection: 'column' }}>
          <ConversationHistory
            label="Test conversation"
            messages={messages}
            data={data}
            streamingIds={streaming ? new Set(['message-60']) : new Set()}
            reduced
            name={(id) => id}
            thread="scout"
            onOpenCard={() => {}}
            answerQuestion={() => {}}
          >
            {null}
          </ConversationHistory>
        </div>
        <ActivityGroup entries={entries} />
        <ConversationQueue
          queued={[queued]}
          data={data}
          thread="scout"
          working={false}
          action={async (path, method, body) => {
            setQueueAction(JSON.stringify({ path, method, body }));
          }}
        />
        <output aria-label="Queue action">{queueAction}</output>
        <Suggestion suggestion="Help with my application" onClick={setDraft}>
          Suggested prompt
        </Suggestion>
        <PromptInput
          onSubmit={({ text }) => {
            setAttempts((previous) => previous + 1);
            if (fail) throw new Error('Simulated request failure');
            setSubmitted(text);
            setDraft('');
            setFiles([]);
          }}
        >
          <ComposerAttachments
            files={files}
            removeFile={(index) => setFiles((previous) => previous.filter((_, i) => i !== index))}
            disabled={false}
          />
          <PromptInputTextarea
            aria-label="Test message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <PromptInputSubmit />
        </PromptInput>
        <Button onClick={() => setFail(false)}>Allow send</Button>
        <output aria-label="Send attempts">{attempts}</output>
        <output aria-label="Submitted text">{submitted}</output>
        <section
          aria-label="Source preview examples"
          style={{ width: 320, maxWidth: '100%', margin: '24px auto' }}
        >
          <AccordionSection heading="Review draft" defaultOpen>
            <Input aria-label="Saved draft" defaultValue="Original draft" />
            <AccordionSection heading="Draft evidence">
              <p>Fictional supporting evidence</p>
            </AccordionSection>
          </AccordionSection>
          <ServiceCommand command="bun run service status" />
          <BrowserActionSummary
            action={{
              kind: 'fill',
              selector: '#cover-letter',
              value: 'First line\n\n<script>fictional()</script> & exact text',
            }}
          />
          <SourceBlock
            label="Profile source"
            value={
              '# Profile\n\n' +
              'An intentionally long source line with preserved whitespace. '.repeat(100)
            }
            contentClassName="max-h-44 font-sans"
          />
        </section>
      </div>
    </AppMotion>
  );
};

const code = 'const answer = 42;\n\nconsole.log(answer);\n';
const initial: ChatMessage[] = Array.from({ length: 61 }, (_, index) => ({
  id: `message-${index}`,
  threadId: 'scout',
  from: index === 60 || index % 2 ? 'scout' : 'user',
  to: 'scout',
  content:
    index === 60
      ? `Inline \`hello\`.\n\n\`\`\`js\n${code}\`\`\`\n\n![Private image](https://example.com/private.png)\n\n[External source](https://example.com/source)`
      : `Message ${index}\n\n${'A fictional conversation for scroll verification.\n\n'.repeat(3)}`,
  runId: null,
  cardId: null,
  createdAt: new Date(Date.UTC(2026, 9, 1, 0, index)).toISOString(),
}));
const data = { cards: [], runs: [], streamingMessages: [], roles: [] } as unknown as Snapshot;
const entries: RunActivity[] = [
  {
    id: 'tool',
    kind: 'tool',
    label: 'Read profile',
    status: 'failed',
    startedAt: initial[0].createdAt,
    finishedAt: initial[1].createdAt,
  },
  {
    id: 'reasoning',
    kind: 'reasoning',
    label: 'Thinking',
    status: 'completed',
    startedAt: initial[0].createdAt,
    finishedAt: initial[1].createdAt,
    text: 'PRIVATE_REASONING_MUST_NEVER_RENDER',
  },
];

const queued: ChatRequest = {
  id: 'request',
  threadId: 'scout',
  messageId: 'pending',
  content: 'Queued follow-up',
  attachments: [],
  createdAt: initial[0].createdAt,
  order: 1,
  deliveries: [{ roleId: 'scout', status: 'paused', runId: null, error: '' }],
};

createRoot(document.getElementById('root')!).render(<Fixture />);
