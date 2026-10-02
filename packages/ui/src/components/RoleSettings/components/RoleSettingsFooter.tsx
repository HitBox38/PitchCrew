import type { RoleSettingsFooterProps } from '@/components/RoleSettings/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Check, LoaderCircle } from 'lucide-react';

export function RoleSettingsFooter({
  error,
  onClose,
  working,
  runtimeAvailable,
}: RoleSettingsFooterProps) {
  return (
    <footer className="role-settings-footer">
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      <div className="role-settings-actions">
        <Button className="button" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" className="button primary" disabled={working || !runtimeAvailable}>
          {working ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />}
          Save settings
        </Button>
      </div>
    </footer>
  );
}
