import { copyReferenceSelection } from '../clipboard.ts';
import { useMemo } from 'react';
import { agentChatReferences } from '@pitchcrew/core/chat-references';
import type { StreamdownProps } from 'streamdown';
import type { ChatMessage } from '@pitchcrew/core';
import type { ReferenceCatalog } from '../types.ts';
import { referenceMarkdown } from '../markdown.ts';
import { ReferenceMarkdownChip } from './ReferenceMarkdownChip.tsx';
import { FileMarkdownCitation } from './FileMarkdownCitation.tsx';
import { ReferenceContext } from '../context.ts';
import { MessageResponse } from '@/components/ai-elements/message/components/MessageResponse.tsx';
import { noRemoteImages } from '@/components/ai-elements/message/constants.tsx';
export const ReferenceMessage = ({
  message,
  catalog,
  streaming,
}: {
  message: ChatMessage;
  catalog: ReferenceCatalog;
  streaming: boolean;
}) => {
  const mention = message.from !== 'user' && message.from !== 'system';
  const references = useMemo(
    () =>
      message.references ?? (mention ? agentChatReferences(message.content, catalog.roles) : []),
    [message.references, message.content, mention, catalog.roles],
  );
  const decorated = references.length > 0 || message.content.includes('pitchcrew-file:');
  const plugins = useMemo<StreamdownProps['remarkPlugins']>(
    () => (decorated ? [[referenceMarkdown, { content: message.content, references }]] : undefined),
    [message.content, references, decorated],
  );
  return (
    <ReferenceContext value={{ references: references ?? [], catalog, mention }}>
      <div className="contents" onCopy={copyReferenceSelection}>
        <MessageResponse
          mode={streaming ? 'streaming' : 'static'}
          isAnimating={streaming}
          components={components}
          remarkPlugins={plugins}
          allowedTags={allowedTags}
          parseMarkdownIntoBlocksFn={decorated ? oneBlock : undefined}
        >
          {message.content}
        </MessageResponse>
      </div>
    </ReferenceContext>
  );
};

const oneBlock = (text: string) => [text];
const allowedTags = { 'chat-reference': ['index'], 'file-citation': ['url', 'label'] };
const components = {
  ...noRemoteImages,
  'chat-reference': ReferenceMarkdownChip,
  'file-citation': FileMarkdownCitation,
};
