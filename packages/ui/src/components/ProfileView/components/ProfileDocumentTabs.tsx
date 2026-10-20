import type { ProfileViewModel } from '../types.ts';
import { useState } from 'react';
import { TabsList } from '@/components/ui/tabs/index.tsx';
import { DragDropProvider } from '@dnd-kit/react';
import { isSortableOperation } from '@dnd-kit/react/sortable';
import { ProfileDocumentTab } from './ProfileDocumentTab.tsx';
import { profileTabPlugins, profileTabSensors } from '../tab-drag.ts';
import { profileTabModifiers } from '../tab-drag-modifier.ts';

export const ProfileDocumentTabs = (c: ProfileViewModel) => {
  const [announcement, setAnnouncement] = useState('');
  return (
    <DragDropProvider
      sensors={profileTabSensors}
      plugins={profileTabPlugins}
      modifiers={profileTabModifiers}
      onDragEnd={({ operation, canceled }) => {
        if (!canceled && operation.target && isSortableOperation(operation) && operation.source)
          c.reorderNote(String(operation.source.id), operation.source.index);
      }}
    >
      <TabsList className="profile-document-tabs" aria-label="Open profile notes">
        {c.documents.map((document, index) => (
          <ProfileDocumentTab
            key={document.id}
            document={document}
            index={index}
            count={c.documents.length}
            active={document.id === c.activeId}
            close={() => c.closeNote(document.id)}
            reorder={(next) => {
              if (next < 0 || next >= c.documents.length) return;
              c.reorderNote(document.id, next);
              setAnnouncement(
                `Moved ${document.name}. Position ${next + 1} of ${c.documents.length}.`,
              );
            }}
          />
        ))}
      </TabsList>
      <output className="sr-only" aria-live="polite">
        {announcement}
      </output>
    </DragDropProvider>
  );
};
