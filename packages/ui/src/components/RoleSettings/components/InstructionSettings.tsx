import type { InstructionSettingsProps } from '@/components/RoleSettings/types.ts';
import { Textarea } from '@/components/ui/textarea/components/Textarea.tsx';

export function InstructionSettings({
  role,
  instructions,
  setInstructions,
}: InstructionSettingsProps) {
  return (
    <section className="role-settings-section" aria-labelledby={`${role.id}-instructions-heading`}>
      <h3 id={`${role.id}-instructions-heading`}>
        <label htmlFor={`${role.id}-instructions`}>Role instructions</label>
      </h3>
      <p className="quiet">Describe how {role.name} should approach its work.</p>
      <Textarea
        id={`${role.id}-instructions`}
        rows={10}
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        maxLength={12000}
      />
    </section>
  );
}
