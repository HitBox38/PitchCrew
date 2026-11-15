import type { RemoteMcpInfo } from '@pitchcrew/core';
import { Button } from '@pitchcrew/design-system/button';
import {
  CodeBlock,
  CodeBlockHeader,
  CodeBlockTitle,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockContent,
} from '@pitchcrew/design-system/code-block';

export const GrokHandoff = ({ info }: { info: RemoteMcpInfo }) => {
  if (info.state !== 'ready' || !info.url)
    return <p className="quiet">Your message will appear when the temporary address is ready.</p>;
  const message = `Add the MCP server ${info.url} and connect it.`;
  return (
    <div className="remote-mcp-handoff">
      <CodeBlock size="sm">
        <CodeBlockHeader>
          <CodeBlockTitle>Message for Grok Bot</CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton
              key={message}
              value={message}
              label="Copy message"
              aria-label="Copy message"
              variant="default"
              size="sm"
            />
          </CodeBlockActions>
        </CodeBlockHeader>
        <CodeBlockContent aria-label="Message for Grok Bot" wrap>
          {message}
        </CodeBlockContent>
      </CodeBlock>
      <p className="quiet">
        Send this to your Grok Bot and follow its connection prompt. No Grok Build API key is
        needed.
      </p>
      <div className="remote-mcp-actions">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={
            <a
              href="https://x.ai/bot"
              target="_blank"
              rel="noreferrer"
              aria-label="Grok Bot website"
            />
          }
        >
          Grok Bot website
        </Button>
      </div>
    </div>
  );
};
