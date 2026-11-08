import { useState, type ComponentProps } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { noRemoteImages } from '@/components/ai-elements/message/constants.tsx';
import { MarkdownContent } from '@/components/MarkdownContent/index.tsx';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import { copyText } from '@/lib/clipboard.ts';

// Plain headings so the sheet's document scale applies instead of chat-sized utility classes.
const sheetComponents = {
  ...noRemoteImages,
  h1: (props: ComponentProps<'h1'>) => <h1>{props.children}</h1>,
  h2: (props: ComponentProps<'h2'>) => <h2>{props.children}</h2>,
  h3: (props: ComponentProps<'h3'>) => <h3>{props.children}</h3>,
};

/**
 * One packet document, readable by default. Source shows and copies the exact saved text;
 * neither view edits or rewrites it, and remote images never load.
 */
export const PacketDocumentView = ({ label, text }: { label: string; text: string }) => {
  const [source, setSource] = useState(false);
  return (
    <section className="job-packet-document" aria-label={label}>
      <div className="job-packet-toolbar">
        <fieldset aria-label={`${label} view`} className="ui-segment">
          <Button size="sm" variant="ghost" aria-pressed={!source} onClick={() => setSource(false)}>
            Readable
          </Button>
          <Button size="sm" variant="ghost" aria-pressed={source} onClick={() => setSource(true)}>
            Source
          </Button>
        </fieldset>
        {source ? null : (
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Copy ${label} text`}
            onClick={() => copyText(text, `Copied ${label} text`)}
          >
            <Copy size={14} aria-hidden="true" />
            Copy text
          </Button>
        )}
      </div>
      {!text.trim() ? (
        <p className="quiet">This document is empty.</p>
      ) : source ? (
        <SourceBlock label={label} value={text} contentClassName="text-body leading-relaxed" />
      ) : (
        <article className="job-packet-sheet">
          <MarkdownContent components={sheetComponents}>{text}</MarkdownContent>
        </article>
      )}
    </section>
  );
};
