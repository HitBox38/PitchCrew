import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ChatMessage, ChatReference, Skill } from '@pitchcrew/core';
import { ChatComposerEditor } from '@/ChatComposer/index.tsx';
import { ReferenceMessage } from '@/ChatReferences/index.tsx';
import { PromptInput } from '@/components/ai-elements/prompt-input/components/PromptInput.tsx';
import { PromptInputSubmit } from '@/components/ai-elements/prompt-input/components/PromptInputSubmit.tsx';
import type { ComposerSuggestion } from '@/ChatComposer/types.ts';
import '@/styles.css';
import '@/styles/chat.css';
const suggestions: ComposerSuggestion[] = [
  {
    key: 'agent:reviewer',
    label: 'Reviewer',
    description: 'Review the packet',
    reference: { kind: 'agent', id: 'reviewer', token: '@reviewer', label: 'Reviewer' },
  },
  {
    key: 'agent:writer',
    label: 'Writer',
    description: 'Paused',
    disabled: 'Paused',
    reference: { kind: 'agent', id: 'writer', token: '@writer', label: 'Writer' },
  },
  {
    key: 'skill:check',
    label: 'Evidence check',
    description: 'Check quotations',
    reference: {
      kind: 'skill',
      id: 'check',
      token: '$evidence-check',
      label: 'Evidence check',
      revision: 'first',
    },
  },
  { key: 'action:attach', label: '/attach', description: 'Choose files', action: 'attach' },
  { key: 'action:job', label: '/job', description: 'Choose a job', action: 'job' },
  { key: 'action:skills', label: '/skills', description: 'Browse skills', action: 'skills' },
];
function Fixture() {
  const [value, setValue] = useState('');
  const [references, setReferences] = useState<ChatReference[]>([]);
  const [sent, setSent] = useState<ChatMessage | null>(null);
  const [action, setAction] = useState('');
  const [fail, setFail] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);
  const send = () => {
    if (fail) {
      setAction('Failed; draft retained');
      return;
    }
    setSent({
      id: 'sent',
      threadId: 'reviewer',
      from: 'user',
      to: 'reviewer',
      cardId: null,
      runId: null,
      createdAt: '',
      content: value,
      references,
    });
    setValue('');
    setReferences([]);
  };
  return (
    <div className="chat-workspace" style={{ maxWidth: 760, margin: 'auto', paddingTop: 350 }}>
      <button type="button" onClick={() => setFail(!fail)}>
        Toggle failure
      </button>
      <button
        type="button"
        onClick={() => {
          const content =
            'Use $evidence-check with **care**.\n\nKeep `$evidence-check` literal. [Link $evidence-check](https://example.com)';
          setSent({
            id: 'markdown',
            threadId: 'reviewer',
            from: 'user',
            to: 'reviewer',
            cardId: null,
            runId: null,
            createdAt: '',
            content,
            references: [
              {
                kind: 'skill',
                id: 'check',
                label: 'Evidence check',
                token: '$evidence-check',
                revision: 'first',
                start: 4,
                end: 19,
              },
            ],
          });
        }}
      >
        Sample Markdown
      </button>
      <output id="action">{action}</output>
      {sent ? (
        <div id="sent" className="chat-message-content">
          <ReferenceMessage
            message={sent}
            catalog={{ roles: [], skills: [{ id: 'check', updatedAt: 'first' } as Skill] }}
            streaming={false}
          />
        </div>
      ) : null}
      <div className="chat-compose">
        <PromptInput onSubmit={send} className="chat-prompt">
          <ChatComposerEditor
            thread="fixture"
            value={value}
            references={references}
            onChange={(text, refs) => {
              setValue(text);
              setReferences(refs);
            }}
            inputRef={inputRef}
            disabled={false}
            label="Message the crew"
            placeholder="Use @, $ or /"
            suggestions={suggestions}
            onAction={setAction}
            onFiles={(files) => setAction(files.map((f) => f.name).join(', '))}
            onSend={send}
          />
          <PromptInputSubmit>Send</PromptInputSubmit>
        </PromptInput>
      </div>
      <pre id="canonical">{value}</pre>
      <pre id="references">{JSON.stringify(references)}</pre>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
