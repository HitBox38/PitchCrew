import { Textarea } from '@/components/ui/textarea/components/Textarea.tsx';
import type { SkillInstructionsProps } from '@/SkillsView/components/SkillEditor/types.ts';
import { skillContentLimit } from '@pitchcrew/core/base-skills';

export function SkillInstructions({ content, setContent, source }: SkillInstructionsProps) {
  return (
    <section className="role-settings-section" aria-labelledby="skill-content-heading">
      <h3 id="skill-content-heading">
        <label htmlFor="skill-content">Instructions</label>
      </h3>
      <p className="quiet">
        Write in Markdown. Explain when to use the skill and the steps to follow.
      </p>
      <Textarea
        id="skill-content"
        className="skill-markdown"
        rows={14}
        required
        maxLength={skillContentLimit}
        placeholder={
          '# Clear application writing\n\nUse when drafting an application.\n\n- Lead with relevant experience.\n- Keep sentences direct and specific.\n- Support every claim with a profile quotation.'
        }
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      {source ? (
        <p className="quiet skill-source">
          Based on {source.url}
          <br />
          Source file: {source.path}
        </p>
      ) : null}
      <span className="quiet">
        {content.length.toLocaleString()} / {skillContentLimit.toLocaleString()} characters
      </span>
    </section>
  );
}
