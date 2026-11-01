import type { RoleSettingsModel } from '@/components/RoleSettings/types.ts';
import { Button } from '@pitchcrew/design-system/button';
import { LoaderCircle } from 'lucide-react';

/** One Save for the whole panel; a blocked save says why beside it instead of hiding the button. */
export const RoleSettingsFooter = ({
  role,
  data,
  creating,
  error,
  onClose,
  working,
}: RoleSettingsModel) => {
  const running = data.runs.some((run) => run.roleId === role.id && run.status === 'running');
  const blocked = !creating && running ? `Wait until ${role.name}’s run finishes.` : '';
  return (
    <footer className="ui-footer-bar agent-panel-footer">
      {error ? (
        <p role="alert" className="form-error agent-panel-error">
          {error}
        </p>
      ) : null}
      <span className="ui-footer-note">{blocked}</span>
      <Button className="button small" type="button" onClick={onClose}>
        Cancel
      </Button>
      <Button type="submit" className="button small primary" disabled={working || !!blocked}>
        {working ? <LoaderCircle size={14} className="spin" aria-hidden="true" /> : null}
        {creating ? 'Create role' : 'Save settings'}
      </Button>
    </footer>
  );
};
