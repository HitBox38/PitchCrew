import { Button } from '@/components/ui/button/components/Button.tsx';
import type { SkillEditorFooterProps } from '@/SkillsView/components/SkillEditor/types.ts';
import { Check, LoaderCircle } from 'lucide-react';

export function SkillEditorFooter({
  error,
  working,
  onClose,
  loading,
  skill,
}: SkillEditorFooterProps) {
  return (
    <footer className="role-settings-footer">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="role-settings-actions">
        <Button className="button" disabled={working} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" className="button primary" disabled={working || loading}>
          {working ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}
          {skill ? 'Save changes' : 'Add skill'}
        </Button>
      </div>
    </footer>
  );
}
