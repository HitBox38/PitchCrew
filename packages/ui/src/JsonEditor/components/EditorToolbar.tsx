import { Braces } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { modKey } from '@/shortcuts.ts';
import { EditorSettings } from './EditorSettings.tsx';

export const EditorToolbar = ({
  format,
  invalid,
  filename,
}: {
  format: () => void;
  invalid: boolean;
  filename: string;
}) => {
  return (
    <div className="json-editor-toolbar flex flex-wrap items-center gap-2">
      <span className="mr-auto flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <Braces size={15} aria-hidden="true" /> {filename}
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={format}
        disabled={invalid}
        title={`Format JSON (${modKey}Shift+F)`}
      >
        Format
      </Button>
      <EditorSettings />
    </div>
  );
};
