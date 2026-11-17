import {
  ClipboardCopy,
  Copy,
  Ellipsis,
  PanelLeft,
  RotateCw,
  TextCursor,
  WrapText,
} from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from '@pitchcrew/design-system/dropdown-menu';
import { useMediaQuery } from '@/hooks/useMediaQuery.ts';
import type { FileViewerModel } from '../hooks/useFileViewer.ts';
export const ViewerMoreControls = ({ model }: { model: FileViewerModel }) => {
  const { file, settings, change } = model;
  // Phones have no room for a thumbnail column beside the page.
  const phone = useMediaQuery('(width < 48rem)');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button size="sm" variant="ghost" aria-label="More file controls" />}
      >
        <Ellipsis size={17} />
        <span className="file-more-label">More</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {file.kind === 'pdf' || file.kind === 'image' ? (
            <DropdownMenuItem onClick={() => change({ rotation: (settings.rotation + 90) % 360 })}>
              <RotateCw size={16} /> Rotate view
            </DropdownMenuItem>
          ) : null}
          {file.kind === 'pdf' && !phone ? (
            <DropdownMenuItem onClick={() => change({ thumbnails: !settings.thumbnails })}>
              <PanelLeft size={16} /> {settings.thumbnails ? 'Hide' : 'Show'} page thumbnails
            </DropdownMenuItem>
          ) : null}
          {file.kind !== 'image' ? (
            <DropdownMenuItem onClick={model.copySelection}>
              <TextCursor size={15} /> Copy selection
            </DropdownMenuItem>
          ) : null}
          {file.kind === 'markdown' || file.kind === 'text' ? (
            <DropdownMenuItem onClick={model.copyAll}>
              <ClipboardCopy size={15} /> Copy all
            </DropdownMenuItem>
          ) : null}
          {file.text !== undefined && file.kind !== 'text' ? (
            <DropdownMenuItem onClick={model.copySource}>
              <Copy size={15} /> {file.kind === 'markdown' ? 'Copy Markdown' : 'Copy source'}
            </DropdownMenuItem>
          ) : null}
          {file.kind === 'text' || settings.mode === 'source' ? (
            <DropdownMenuItem onClick={() => change({ wrap: !settings.wrap })}>
              <WrapText size={15} /> {settings.wrap ? 'Turn off line wrap' : 'Wrap lines'}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
