import { X } from 'lucide-react';
import { useSortable } from '@dnd-kit/react/sortable';
import { TabsTrigger } from '@pitchcrew/design-system/tabs';
import { Button } from '@pitchcrew/design-system/button';
import { useAppReducedMotion } from '@/AppMotion/hooks/useAppReducedMotion.ts';
import type { ProfileDocument, ProfileSectionProps } from '../types.ts';
import { documentDirty } from '../documents.ts';
import { noteLabel } from '../helpers.ts';
import { ProfileTabMenu } from './ProfileTabMenu.tsx';

/**
 * One open note. Like a code editor's tab: drag or Alt+arrows to reorder, middle-click to close,
 * and an unsaved dot that turns into the close button on hover.
 */
export const ProfileDocumentTab = ({
  document,
  index,
  count,
  active,
  close,
  reorder,
  section,
}: {
  document: ProfileDocument;
  index: number;
  count: number;
  active: boolean;
  close: () => void;
  reorder: (index: number) => void;
  section: ProfileSectionProps;
}) => {
  const reduced = useAppReducedMotion();
  const dirty = documentDirty(document);
  const label = noteLabel(document.name || 'Untitled note');
  const { ref, handleRef, isDragging } = useSortable({
    id: document.id,
    index,
    group: 'profile-note-tabs',
    type: 'profile-note-tab',
    data: { label, count },
    transition: { duration: reduced ? 0 : 160 },
  });
  return (
    <ProfileTabMenu document={document} section={section}>
      <div
        ref={ref}
        className="profile-tab-item"
        data-selected={active}
        data-dirty={dirty || undefined}
        data-conflict={document.conflict ? true : undefined}
        data-dragging={isDragging || undefined}
        onAuxClick={(event) => {
          if (event.button !== 1) return;
          event.preventDefault();
          close();
        }}
      >
        <TabsTrigger
          ref={handleRef}
          value={document.id}
          className="profile-document-tab"
          aria-label={`${label}${dirty ? ', unsaved changes' : ''}`}
          aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
          title={`${document.name}${dirty ? ' (unsaved)' : ''}`}
          onKeyDown={(event) => {
            if (event.altKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
              event.preventDefault();
              event.stopPropagation();
              reorder(index + (event.key === 'ArrowLeft' ? -1 : 1));
            }
          }}
        >
          <span className="truncate">{label}</span>
        </TabsTrigger>
        <Button
          variant="ghost"
          className="profile-tab-close"
          aria-label={`Close ${label}`}
          onClick={close}
          disabled={isDragging}
        >
          {dirty ? <span className="profile-dirty-dot" aria-hidden="true" /> : null}
          <X size={13} aria-hidden="true" className="profile-tab-x" />
        </Button>
      </div>
    </ProfileTabMenu>
  );
};
