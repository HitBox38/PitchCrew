import { Button } from '@pitchcrew/design-system/button';
import { PanelActions } from './PanelActions.tsx';

export const ConversationEditorActions = ({
  editing,
  working,
  disabled,
  close,
}: {
  editing: boolean;
  working: boolean;
  disabled: boolean;
  close: () => void;
}) => {
  return (
    <PanelActions>
      <Button className="button" disabled={working} onClick={close}>
        Cancel
      </Button>
      <Button className="button primary" type="submit" disabled={disabled}>
        {editing ? 'Save conversation' : 'Create conversation'}
      </Button>
    </PanelActions>
  );
};
