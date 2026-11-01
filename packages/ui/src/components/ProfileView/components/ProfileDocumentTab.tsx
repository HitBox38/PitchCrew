import type { ProfileDocument } from '../types.ts';
import { TabsTrigger } from '@pitchcrew/design-system/tabs';
import { Button } from '@pitchcrew/design-system/button';
import { documentDirty } from '../helpers.ts';
import { useSortable } from '@dnd-kit/react/sortable';
import { useAppReducedMotion } from '@/AppMotion/hooks/useAppReducedMotion.ts';
import { X } from 'lucide-react';

export const ProfileDocumentTab = ({
  document,
  index,
  count,
  active,
  close,
  reorder,
}: {
  document: ProfileDocument;
  index: number;
  count: number;
  active: boolean;
  close: () => void;
  reorder: (index: number) => void;
}) => {
  const reduced = useAppReducedMotion();
  const dirty = documentDirty(document);
  const { ref, handleRef, isDragging } = useSortable({
    id: document.id,
    index,
    group: 'profile-note-tabs',
    type: 'profile-note-tab',
    data: { label: document.name || 'Untitled note', count },
    transition: { duration: reduced ? 0 : 160 },
  });
  return (
    <div
      ref={ref}
      className="profile-tab-item"
      data-selected={active}
      data-dragging={isDragging || undefined}
    >
      <TabsTrigger
        ref={handleRef}
        value={document.id}
        className="profile-document-tab"
        aria-label={`${document.name || 'Untitled note'}${dirty ? ', unsaved changes' : ''}`}
        aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
        title="Drag to reorder. Keyboard: Alt + left/right arrow."
        onKeyDown={(event) => {
          if (event.altKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
            event.preventDefault();
            event.stopPropagation();
            reorder(index + (event.key === 'ArrowLeft' ? -1 : 1));
          }
        }}
      >
        <span className="truncate">{document.name || 'Untitled note'}</span>
        {dirty ? <span className="profile-dirty-dot" aria-hidden="true" /> : null}
      </TabsTrigger>
      <Button
        variant="ghost"
        className="profile-tab-close"
        aria-label={`Close ${document.name || 'Untitled note'}`}
        onClick={close}
        disabled={isDragging}
      >
        <X size={13} aria-hidden="true" />
      </Button>
    </div>
  );
};
