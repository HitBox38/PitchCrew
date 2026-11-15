import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Bold, Search } from 'lucide-react';
import { ToolbarButton } from './ToolbarButton.tsx';
import { blockTools, extraTools, inlineTools, keepOneTabStop, roveToolbar } from '../toolbar.ts';
import { MoreTools } from './MoreTools.tsx';
import { HeadingMenu } from './HeadingMenu.tsx';
import { editorKeys } from '../shortcuts.ts';
import type { MarkdownEditorHandle, MarkdownFormat } from '../types.ts';

/**
 * Formatting for people who do not write Markdown by heart; every tool has a shortcut too, and
 * the formats around the caret show pressed. In Preview the band stays (so the note does not
 * jump) and says it is read only.
 */
export const MarkdownToolbar = ({
  handle,
  disabled,
  preview = false,
  active = [],
  onFind,
  end,
}: {
  handle: RefObject<MarkdownEditorHandle | null>;
  disabled?: boolean;
  preview?: boolean;
  active?: readonly MarkdownFormat[];
  /** Find from any mode; defaults to the editor's find bar. */
  onFind?: () => void;
  end?: ReactNode;
}) => {
  const format = (kind: MarkdownFormat) => handle.current?.format(kind);
  const bar = useRef<HTMLDivElement>(null);
  const off = disabled || preview;
  useLayoutEffect(() => keepOneTabStop(bar.current), [off]);
  const tool = ([kind, label, Icon]: readonly [MarkdownFormat, string, typeof Bold]) => (
    <ToolbarButton
      key={kind}
      label={label}
      keys={kind in editorKeys ? editorKeys[kind as keyof typeof editorKeys] : undefined}
      disabled={off}
      pressed={active.includes(kind)}
      data-extra={extraTools.has(kind) || undefined}
      onClick={() => format(kind)}
    >
      <Icon size={16} aria-hidden="true" />
    </ToolbarButton>
  );
  return (
    <div
      className="md-toolbar"
      role="toolbar"
      aria-label="Formatting"
      data-disabled={preview || undefined}
      ref={bar}
      tabIndex={-1}
      onKeyDown={roveToolbar}
      onFocus={(event) => keepOneTabStop(bar.current, event.target as HTMLElement)}
    >
      {preview ? <span className="md-toolbar-note">Preview · edit in Write</span> : null}
      <HeadingMenu disabled={off} format={format} active={active} />
      <span className="md-toolbar-gap" aria-hidden="true" />
      {inlineTools.map(tool)}
      <span className="md-toolbar-gap" aria-hidden="true" />
      {blockTools.map(tool)}
      <span className="md-toolbar-end">
        <MoreTools disabled={off} format={format} />
        <ToolbarButton
          label="Find and replace"
          keys={editorKeys.find}
          disabled={disabled}
          className="md-tool md-tool-keep"
          onClick={() => (onFind ? onFind() : handle.current?.openSearch())}
        >
          <Search size={16} aria-hidden="true" />
        </ToolbarButton>
        {end}
      </span>
    </div>
  );
};
