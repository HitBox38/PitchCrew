import { Ellipsis, RotateCw, PanelLeft, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu/index.tsx';
import { copyText } from '@/lib/clipboard.ts';
import type { FileViewerModel } from '../hooks/useFileViewer.ts';
export const ViewerMoreControls = ({ model }: { model: FileViewerModel }) => {
  const { file, settings, change } = model;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button size="sm" variant="ghost" aria-label="More file controls" />}
      >
        <Ellipsis size={17} /> More
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {file.kind === 'pdf' || file.kind === 'image' ? (
            <DropdownMenuItem onClick={() => change({ rotation: (settings.rotation + 90) % 360 })}>
              <RotateCw size={16} /> Rotate view
            </DropdownMenuItem>
          ) : null}
          {file.kind === 'pdf' ? (
            <DropdownMenuItem onClick={() => change({ thumbnails: !settings.thumbnails })}>
              <PanelLeft size={16} /> {settings.thumbnails ? 'Hide' : 'Show'} page thumbnails
            </DropdownMenuItem>
          ) : null}
          {file.kind !== 'image' ? (
            <DropdownMenuItem onClick={model.copySelection}>Copy selection</DropdownMenuItem>
          ) : null}
          {file.text !== undefined ? (
            <DropdownMenuItem onClick={() => copyText(file.text ?? '', 'Copied exact source')}>
              <Copy size={15} /> {file.kind === 'markdown' ? 'Copy Markdown' : 'Copy source'}
            </DropdownMenuItem>
          ) : null}
          {file.kind === 'text' || settings.mode === 'source' ? (
            <DropdownMenuItem onClick={() => change({ wrap: !settings.wrap })}>
              {settings.wrap ? 'Turn off line wrap' : 'Wrap lines'}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
