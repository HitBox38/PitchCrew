import { Button } from '@/components/ui/button/components/Button.tsx';

export function ConversationEditorActions({
  editing,
  working,
  disabled,
  close,
}: {
  editing: boolean;
  working: boolean;
  disabled: boolean;
  close: () => void;
}) {
  return (
    <div className="flex justify-end gap-3">
      <Button className="text-button" variant="ghost" disabled={working} onClick={close}>
        Cancel
      </Button>
      <Button type="submit" disabled={disabled}>
        {editing ? 'Save conversation' : 'Create conversation'}
      </Button>
    </div>
  );
}
