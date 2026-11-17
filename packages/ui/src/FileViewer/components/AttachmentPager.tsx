import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import type { FileViewerModel } from '../hooks/useFileViewer.ts';

/**
 * Previous / Next attachment in a fixed slot at the start of the toolbar, so repeated clicks land
 * on the same button whatever the filename. Absent for a single file, such as a chat citation.
 */
export const AttachmentPager = ({ model }: { model: FileViewerModel }) =>
  model.files.length > 1 ? (
    <fieldset className="file-pager" aria-label="Attachment navigation">
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Previous attachment"
        title="Previous attachment"
        disabled={!model.index}
        onClick={() => model.move(model.index - 1)}
      >
        <ChevronLeft size={17} />
      </Button>
      <span className="file-pager-count">
        {model.index + 1} of {model.files.length}
      </span>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Next attachment"
        title="Next attachment"
        disabled={model.index === model.files.length - 1}
        onClick={() => model.move(model.index + 1)}
      >
        <ChevronRight size={17} />
      </Button>
    </fieldset>
  ) : null;
