import { packetDocumentLabels } from '@/lib/packet-labels.ts';
import type { PacketDocumentPickerProps } from '@/components/CardDetails/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';

export const PacketDocumentPicker = ({ document, setDocument }: PacketDocumentPickerProps) => {
  return (
    <div className="document-select">
      {(['resume', 'coverLetter', 'formAnswers', 'note'] as const).map((name) => (
        <Button
          className={document === name ? 'selected' : ''}
          key={name}
          onClick={() => setDocument(name)}
        >
          {packetDocumentLabels[name]}
        </Button>
      ))}
    </div>
  );
};
