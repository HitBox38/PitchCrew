import { useState } from 'react';
import { Separator } from '@pitchcrew/design-system/separator';
import { explorerBounds } from '../layout.ts';
import type { ProfileWorkspaceModel } from '../types.ts';

const step = 16;

/** The handle between the explorer and the note: drag or arrow keys; double-click resets it. */
export const ProfileResizer = ({ workspace }: { workspace: ProfileWorkspaceModel }) => {
  const { explorerWidth: width, resizeExplorer: resize } = workspace;
  const [dragging, setDragging] = useState(false);
  return (
    <Separator
      orientation="vertical"
      render={<div />}
      tabIndex={0}
      aria-orientation="vertical"
      aria-label="Resize notes explorer"
      aria-controls="profile-explorer"
      aria-valuemin={explorerBounds.min}
      aria-valuemax={explorerBounds.max}
      aria-valuenow={width}
      title="Drag to resize the explorer. Double-click to reset."
      className="profile-resizer"
      data-dragging={dragging || undefined}
      onKeyDown={(event) => {
        const moves: Record<string, number> = {
          ArrowLeft: width - step,
          ArrowRight: width + step,
          Home: explorerBounds.min,
          End: explorerBounds.max,
        };
        const next = moves[event.key];
        if (next === undefined) return;
        event.preventDefault();
        resize(next);
      }}
      onDoubleClick={() => resize(explorerBounds.initial)}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const frame = event.currentTarget.parentElement!.getBoundingClientRect();
        resize(event.clientX - frame.left - 4);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        setDragging(false);
      }}
      onLostPointerCapture={() => {
        setDragging(false);
      }}
    />
  );
};
