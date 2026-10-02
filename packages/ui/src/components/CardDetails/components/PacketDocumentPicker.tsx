import type { PacketDocumentPickerProps } from '@/components/CardDetails/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';

export function PacketDocumentPicker({ document, setDocument }: PacketDocumentPickerProps) {
  return (
    <div className="document-select">
      {(['resume', 'coverLetter', 'formAnswers', 'note'] as const).map((name) => (
        <Button
          className={document === name ? 'selected' : ''}
          key={name}
          onClick={() => setDocument(name)}
        >
          {name === 'coverLetter'
            ? 'Cover letter'
            : name === 'formAnswers'
              ? 'Form answers'
              : name === 'resume'
                ? 'Resume'
                : 'Note'}
        </Button>
      ))}
    </div>
  );
}
