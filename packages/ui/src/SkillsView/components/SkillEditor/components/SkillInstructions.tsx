import { useState } from 'react';
import { MarkdownEditor } from '@/components/MarkdownEditor/index.tsx';
import { MarkdownModeTabs } from '@/components/MarkdownEditor/components/MarkdownModeTabs.tsx';
import { MarkdownStatus } from '@/components/MarkdownEditor/components/MarkdownStatus.tsx';
import { Tabs } from '@/components/ui/tabs/index.tsx';
import type { SkillInstructionsProps } from '@/SkillsView/components/SkillEditor/types.ts';
import { skillContentLimit } from '@pitchcrew/core/base-skills';

export function SkillInstructions({
  content,
  setContent,
  source,
  working,
  loading,
}: SkillInstructionsProps) {
  const [mode, setMode] = useState('write');
  return (
    <section className="role-settings-section" aria-labelledby="skill-content-heading">
      <p className="quiet">
        Write in Markdown. Explain when to use the skill and the steps to follow.
      </p>
      <div className="profile-editor skill-markdown-editor">
        <Tabs value={mode} onValueChange={setMode} className="profile-editor-modes">
          <div className="profile-editor-heading flex min-h-13 shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2">
            <h3 id="skill-content-heading">Instructions</h3>
            <MarkdownModeTabs label="Skill editor mode" />
          </div>
          <MarkdownEditor
            id="skill-content"
            label="Skill Markdown"
            content={content}
            onChange={setContent}
            maxLength={skillContentLimit}
            disabled={working || loading}
            placeholder={
              '# Clear application writing\n\nUse when drafting an application.\n\n- Lead with relevant experience.\n- Support every claim with a profile quotation.'
            }
          />
        </Tabs>
        <MarkdownStatus
          content={content}
          status={`${content.length.toLocaleString()} / ${skillContentLimit.toLocaleString()} characters`}
        />
      </div>
      {source ? (
        <p className="quiet skill-source">
          Based on {source.url}
          <br />
          Source file: {source.path}
        </p>
      ) : null}
    </section>
  );
}
