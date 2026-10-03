import type { RoleSettingsFooterProps } from '@/components/RoleSettings/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Check, LoaderCircle } from 'lucide-react';

export function RoleSettingsFooter({ creating, error, onClose, working }: RoleSettingsFooterProps) {
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
        <Button type="submit" className="button primary" disabled={working}>
          {working ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />}
          {creating ? 'Create role' : 'Save settings'}
        </Button>
      </div>
    </footer>
  );
}
