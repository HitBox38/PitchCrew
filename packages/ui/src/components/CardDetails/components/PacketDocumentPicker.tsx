import { packetDocuments, packetDocumentLabels } from '@pitchcrew/core/packet-documents';
import type { PacketDocumentPickerProps } from '@/components/CardDetails/types.ts';
import { Button } from '@pitchcrew/design-system/button';

export const PacketDocumentPicker = ({ document, setDocument }: PacketDocumentPickerProps) => {
  return (
    <div className="document-select">
      {packetDocuments.map((name) => (
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
