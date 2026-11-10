import type { ProfileSectionProps } from '../types.ts';
import { useLayoutEffect, useRef, useState } from 'react';
import { TabsList } from '@pitchcrew/design-system/tabs';
import { DragDropProvider } from '@dnd-kit/react';
import { isSortableOperation } from '@dnd-kit/react/sortable';
import { ProfileDocumentTab } from './ProfileDocumentTab.tsx';
import { profileTabPlugins, profileTabSensors } from '../tab-drag.ts';
import { profileTabModifiers } from '../tab-drag-modifier.ts';
import { revealTab } from '../tab-reveal.ts';

export const ProfileDocumentTabs = (section: ProfileSectionProps) => {
  const c = section.controller;
  const [announcement, setAnnouncement] = useState('');
  const strip = useRef<HTMLDivElement>(null);
  const activeIndex = c.documents.findIndex((document) => document.id === c.activeId);
  useLayoutEffect(() => {
    const lane = strip.current;
    if (!lane) return;
    const reveal = () => revealTab(lane);
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(lane);
    return () => observer.disconnect();
  }, [c.activeId, activeIndex]);
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
      <TabsList ref={strip} className="profile-document-tabs" aria-label="Open profile notes">
        {c.documents.map((document, index) => (
          <ProfileDocumentTab
            key={document.id}
            document={document}
            index={index}
            count={c.documents.length}
            active={document.id === c.activeId}
            close={() => c.closeNote(document.id)}
            section={section}
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
