import type { Card, Packet } from '@pitchcrew/core';
import { packetReviewLabel, packetTabs, wordCount } from '../packet-panel.ts';
import { MarkdownContent } from '@/components/MarkdownContent/index.tsx';
import { noRemoteImages } from '@/components/ai-elements/message/constants.tsx';
import { Tabs } from '@/components/ui/tabs/components/Tabs.tsx';
import { TabsContent } from '@/components/ui/tabs/components/TabsContent.tsx';
import { TabsList } from '@/components/ui/tabs/components/TabsList.tsx';
import { TabsTrigger } from '@/components/ui/tabs/components/TabsTrigger.tsx';

import type { ComponentProps } from 'react';

// Plain headings so the sheet's document scale applies instead of chat-sized utility classes.
const sheetComponents = {
  ...noRemoteImages,
  h1: (props: ComponentProps<'h1'>) => <h1>{props.children}</h1>,
  h2: (props: ComponentProps<'h2'>) => <h2>{props.children}</h2>,
  h3: (props: ComponentProps<'h3'>) => <h3>{props.children}</h3>,
};

/** The job's current packet documents, read-only; approval stays in Decisions. */
export const PacketDocuments = ({ card, packet }: { card: Card; packet: Packet }) => {
  const tabs = packetTabs(packet);
  return (
    <Tabs defaultValue={tabs[0]?.id} className="chat-packet-tabs">
      <TabsList aria-label="Packet documents" className="w-fit flex-row">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} className="w-auto flex-none">
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="chat-packet-document">
          <article className="chat-packet-sheet">
            <MarkdownContent components={sheetComponents}>{tab.text}</MarkdownContent>
          </article>
          <footer className="chat-packet-footer">
            <span>{wordCount(tab.text)} words</span>
            <span>{packetReviewLabel(card)}</span>
          </footer>
        </TabsContent>
      ))}
    </Tabs>
  );
};
