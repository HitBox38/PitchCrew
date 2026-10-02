import { Button } from '@/components/ui/button/components/Button.tsx';
import { SheetDescription } from '@/components/ui/sheet/components/SheetDescription.tsx';
import { SheetTitle } from '@/components/ui/sheet/components/SheetTitle.tsx';
import type { SkillEditorHeadingProps } from '@/SkillsView/components/SkillEditor/types.ts';
import { BookOpen, X } from 'lucide-react';

export function SkillEditorHeading({
  skill,
  importing,
  working,
  onClose,
}: SkillEditorHeadingProps) {
  return (
    <header className="role-settings-heading">
      <BookOpen size={26} />
      <div>
        <SheetTitle>
          {skill ? 'Edit skill' : importing ? 'Import from skills.sh' : 'Add skill'}
        </SheetTitle>
        <SheetDescription>Describe a reusable way of working for your agents.</SheetDescription>
      </div>
      <Button
        className="icon-button"
        aria-label="Close skill editor"
        disabled={working}
        onClick={onClose}
      >
        <X size={20} />
      </Button>
    </header>
  );
}
