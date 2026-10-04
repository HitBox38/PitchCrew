import { Combobox } from '@base-ui/react/combobox';
import { Plus } from 'lucide-react';

export function TagSuggestions({ custom, atLimit }: { custom: string | null; atLimit: boolean }) {
  return (
    <Combobox.Portal>
      <Combobox.Positioner sideOffset={6} align="start" className="z-50">
        <Combobox.Popup className="tag-picker-popup">
          <Combobox.Empty className="tag-picker-empty">
            {atLimit ? 'Remove a tag to add another.' : 'Type a tag to add it.'}
          </Combobox.Empty>
          <Combobox.List>
            {(tag: string) => (
              <Combobox.Item key={tag} value={tag} disabled={atLimit} className="tag-picker-item">
                {custom === tag ? (
                  <>
                    <Plus size={14} aria-hidden="true" />
                    <span>Add “{tag}”</span>
                  </>
                ) : (
                  <span>{tag}</span>
                )}
              </Combobox.Item>
            )}
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  );
}
