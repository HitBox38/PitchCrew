import { Sheet } from '@/components/ui/sheet/components/Sheet.tsx';
import { SheetContent } from '@/components/ui/sheet/components/SheetContent.tsx';
import { SkillAssignment } from '@/SkillsView/components/SkillEditor/components/SkillAssignment.tsx';
import { SkillDetails } from '@/SkillsView/components/SkillEditor/components/SkillDetails.tsx';
import { SkillEditorFooter } from '@/SkillsView/components/SkillEditor/components/SkillEditorFooter.tsx';
import { SkillEditorHeading } from '@/SkillsView/components/SkillEditor/components/SkillEditorHeading.tsx';
import { SkillImport } from '@/SkillsView/components/SkillEditor/components/SkillImport.tsx';
import { SkillInstructions } from '@/SkillsView/components/SkillEditor/components/SkillInstructions.tsx';
import { useSkillEditor } from '@/SkillsView/components/SkillEditor/hooks/useSkillEditor.ts';
import type { SkillEditorProps } from '@/SkillsView/components/SkillEditor/types.ts';

export function SkillEditor(props: SkillEditorProps) {
  const controller = useSkillEditor(props);
  const { skill, importing, working, onClose, save } = controller;
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !working) onClose();
      }}
    >
      <SheetContent className="role-settings-panel skill-editor-panel" showCloseButton={false}>
        <SkillEditorHeading {...controller} />
        <form className="form role-settings-form" onSubmit={(event) => void save(event)}>
          <div className="role-settings-body">
            {importing || skill?.source ? <SkillImport {...controller} /> : null}
            <SkillDetails {...controller} />
            <SkillAssignment {...controller} />
            <SkillInstructions {...controller} />
          </div>
          <SkillEditorFooter {...controller} />
        </form>
      </SheetContent>
    </Sheet>
  );
}
