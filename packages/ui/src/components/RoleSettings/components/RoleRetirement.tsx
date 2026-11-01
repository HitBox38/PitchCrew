import type { RoleSettingsModel } from '../types.ts';
import { Button } from '@pitchcrew/design-system/button';

/** A separate, named final action; it never rides along with Save settings. */
export const RoleRetirement = ({
  creating,
  role,
  retiring,
  retire,
  working,
}: RoleSettingsModel) => {
  if (creating || role.retiredAt) return null;
  return (
    <section
      className="agent-panel-section"
      id="agent-retire"
      aria-labelledby="agent-retire-heading"
    >
      <h3 id="agent-retire-heading">Retire {role.name}</h3>
      <p className="optional">
        Stops future runs and edits and pauses its routines. Chats, skills and history stay. Restore
        it paused from Crew.
      </p>
      {retiring ? (
        <p className="form-error" role="alert">
          Retire {role.name}? Its ID can’t be reused.
        </p>
      ) : null}
      <Button
        className="button small danger self-start"
        disabled={working}
        onClick={() => void retire()}
      >
        {retiring ? 'Confirm retirement' : 'Retire role'}
      </Button>
    </section>
  );
};
