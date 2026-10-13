import type { ProfileViewModel } from '../types.ts';
import { TabsList, TabsTrigger } from '@/components/ui/tabs/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { documentDirty } from '../helpers.ts';
import { FileText, X } from 'lucide-react';

export function ProfileDocumentTabs(c: ProfileViewModel) {
  return (
    <TabsList className="profile-document-tabs" aria-label="Open profile notes">
      {c.documents.map((document) => (
        <div
          key={document.id}
          className="profile-tab-item"
          data-selected={document.id === c.activeId}
        >
          <TabsTrigger
            value={document.id}
            className="profile-document-tab"
            aria-label={document.name || 'Untitled note'}
          >
            <FileText size={15} />
            <span className="truncate">{document.name || 'Untitled note'}</span>
            {documentDirty(document) ? (
              <span className="profile-dirty-dot" aria-label="Unsaved changes" />
            ) : null}
          </TabsTrigger>
          <Button
            variant="ghost"
            className="profile-tab-close"
            aria-label={`Close ${document.name || 'Untitled note'}`}
            onClick={() => c.closeNote(document.id)}
          >
            <X size={13} />
          </Button>
        </div>
      ))}
    </TabsList>
  );
}
