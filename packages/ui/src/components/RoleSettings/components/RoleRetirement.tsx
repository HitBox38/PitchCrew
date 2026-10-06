import type { RoleSettingsModel } from '../types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
export function RoleRetirement({ creating, role, retiring, retire, working }: RoleSettingsModel) {
  if (creating || role.retiredAt) return null;
  return (
    <section className="role-settings-section">
      <h3>Retire role</h3>
      <p className="quiet">
        Retirement prevents future runs and edits. Chat, routines, skills and events stay in
        history. Its ID cannot be reused.
      </p>
      {retiring ? (
        <p className="form-error" role="alert">
          Retire {role.name} permanently?
        </p>
      ) : null}
      <Button className="button danger self-start" disabled={working} onClick={() => void retire()}>
        {retiring ? 'Confirm retirement' : 'Retire role'}
      </Button>
    </section>
  );
}
