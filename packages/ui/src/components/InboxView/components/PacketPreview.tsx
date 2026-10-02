import type { PacketPreviewProps } from '@/components/InboxView/types.ts';
import { FileText } from 'lucide-react';

export function PacketPreview({ approval }: PacketPreviewProps) {
  return (
    <details className="approval-preview">
      <summary>
        <FileText size={15} /> Show the packet
      </summary>
      {Object.entries(approval.packet)
        .filter(([key]) => key !== 'claims')
        .map(([key, value]) => (
          <div key={key}>
            <h3>
              {key === 'coverLetter'
                ? 'Cover letter'
                : key === 'formAnswers'
                  ? 'Form answers'
                  : key}
            </h3>
            <pre>{String(value)}</pre>
          </div>
        ))}
    </details>
  );
}
