import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';
import { useMarkdownSaveShortcut } from '@/components/MarkdownEditor/hooks/useMarkdownSaveShortcut.ts';
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

export const SkillEditor = (props: SkillEditorProps) => {
  const form = useMarkdownSaveShortcut();
  const controller = useSkillEditor(props);
  const { importing, working, onClose, save, guard } = controller;
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !working) onClose();
      }}
    >
      <SheetContent className="role-settings-panel skill-editor-panel" showCloseButton={false}>
        <SkillEditorHeading {...controller} />
        <form
          ref={form}
          className="form role-settings-form flex flex-col gap-4"
          onSubmit={(event) => void save(event)}
        >
          <div className="role-settings-body">
            {importing ? <SkillImport {...controller} /> : null}
            <SkillDetails {...controller} />
            <SkillInstructions {...controller} />
            <SkillAssignment {...controller} />
          </div>
          <SkillEditorFooter {...controller} />
        </form>
      </SheetContent>
      <DiscardChanges guard={guard} />
    </Sheet>
  );
};
