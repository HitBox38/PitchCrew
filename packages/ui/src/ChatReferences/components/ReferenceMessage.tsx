import { copyReferenceSelection } from '../clipboard.ts';
import { useMemo } from 'react';
import type { StreamdownProps } from 'streamdown';
import type { ChatMessage } from '@pitchcrew/core';
import type { ReferenceCatalog } from '../types.ts';
import { referenceMarkdown } from '../markdown.ts';
import { ReferenceMarkdownChip } from './ReferenceMarkdownChip.tsx';
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
  const references = message.references;
  const plugins = useMemo<StreamdownProps['remarkPlugins']>(
    () =>
      references?.length
        ? [[referenceMarkdown, { content: message.content, references }]]
        : undefined,
    [message.content, references],
  );
  return (
    <ReferenceContext value={{ references: references ?? [], catalog }}>
      <div className="contents" onCopy={copyReferenceSelection}>
        <MessageResponse
          mode={streaming ? 'streaming' : 'static'}
          isAnimating={streaming}
          components={components}
          remarkPlugins={plugins}
          allowedTags={allowedTags}
          parseMarkdownIntoBlocksFn={references?.length ? oneBlock : undefined}
        >
          {message.content}
        </MessageResponse>
      </div>
    </ReferenceContext>
  );
};

const oneBlock = (text: string) => [text];
const allowedTags = { 'chat-reference': ['index'] };
const components = { ...noRemoteImages, 'chat-reference': ReferenceMarkdownChip };
