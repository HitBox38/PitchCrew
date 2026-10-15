import { packetDocumentLabels } from '@/lib/packet-labels.ts';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import type { PacketPreviewProps } from '@/components/InboxView/types.ts';
import { FileText } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion/index.tsx';

export function PacketPreview({ approval }: PacketPreviewProps) {
  return (
    <Accordion className="approval-preview approval-packet-preview" defaultValue={['packet']}>
      <AccordionItem value="packet">
        <AccordionTrigger>
          <span className="flex items-center gap-2">
            <FileText size={15} /> Application packet
          </span>
        </AccordionTrigger>
        <AccordionContent>
          {Object.entries(approval.packet)
            .filter(([key]) => key !== 'claims')
            .map(([key, value]) => (
              <div key={key}>
                <SourceBlock
                  label={packetDocumentLabels[key as keyof typeof packetDocumentLabels]}
                  value={String(value)}
                  contentClassName="font-sans"
                />
              </div>
            ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
