import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { pendingInstructionUpdates } from '@/lib/instruction-updates.ts';
import { availableSkillUpdates, pendingSkillUpdates } from '@/lib/skill-updates.ts';
import { SettingsSection } from './SettingsSection.tsx';

const count = (pending: number, dismissed: number, noun: string) =>
  `${pending ? `${pending} ${noun}${pending === 1 ? '' : 's'} to review` : `No ${noun}s to review`}${dismissed ? ` · ${dismissed} kept as yours` : ''}`;

/** Pending default-instruction and imported-skill updates, linked to their exact reviews. */
export const UpdateReviews = () => {
  const data = useWorkspaceStore((state) => state.data);
  if (!data) return null;
  const instructions = pendingInstructionUpdates(data).length;
  const dismissedInstructions = (data.instructionUpdates ?? []).filter((u) => u.dismissed).length;
  const skills = pendingSkillUpdates(data).length;
  const dismissedSkills = availableSkillUpdates(data).length - skills;
  return (
    <SettingsSection id="agent-instruction-updates-heading" title="Updates to review">
      <Link className="settings-row settings-link-row" to="/crew" search={{ updates: true }}>
        <span>
          <strong>Default instructions</strong>
          <span className="quiet block">
            {count(instructions, dismissedInstructions, 'update')}
          </span>
        </span>
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
      <Link className="settings-row settings-link-row" to="/skills" search={{ updates: true }}>
        <span>
          <strong>Imported skills</strong>
          <span className="quiet block">
            {count(skills, Math.max(0, dismissedSkills), 'update')}
          </span>
        </span>
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </SettingsSection>
  );
};
