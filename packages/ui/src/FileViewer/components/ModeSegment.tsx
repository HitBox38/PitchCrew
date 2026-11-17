import { Button } from '@pitchcrew/design-system/button';
import type { FileViewerModel } from '../hooks/useFileViewer.ts';

/** Rendered (Preview for Word) / Source, always in the toolbar for Markdown and DOCX. */
export const ModeSegment = ({ model: { file, settings, change } }: { model: FileViewerModel }) =>
  file.kind === 'markdown' || file.kind === 'docx' ? (
    <fieldset aria-label="Document view" className="ui-segment file-mode-toggle">
      <Button
        size="sm"
        variant="ghost"
        aria-pressed={settings.mode === 'rendered'}
        onClick={() => change({ mode: 'rendered' })}
      >
        {file.kind === 'markdown' ? 'Rendered' : 'Preview'}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        aria-pressed={settings.mode === 'source'}
        onClick={() => change({ mode: 'source' })}
      >
        Source
      </Button>
    </fieldset>
  ) : null;
