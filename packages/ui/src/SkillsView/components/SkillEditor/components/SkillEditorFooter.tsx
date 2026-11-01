import { Button } from '@/components/ui/button/components/Button.tsx';
import { skillContentLimit } from '@pitchcrew/core/base-skills';
import type { SkillEditorModel } from '../types.ts';
import { LoaderCircle } from 'lucide-react';

/** Save bar: size and source on the left, the blocking error, then Cancel and Save ⌘S. */
export const SkillEditorFooter = (c: SkillEditorModel) => {
  const words = c.content.trim() ? c.content.trim().split(/\s+/u).length : 0;
  return (
    <footer className="skills-savebar">
      <span className="skills-savebar-note">
        {words} {words === 1 ? 'word' : 'words'} · {c.content.length.toLocaleString()} /{' '}
        {skillContentLimit.toLocaleString()} characters
        {c.source ? <span className="skills-source"> · {c.source.path}</span> : null}
      </span>
      {c.error ? (
        <p className="form-error" role="alert">
          {c.error}
        </p>
      ) : null}
      <Button className="button small" disabled={c.working} onClick={c.onClose}>
        Cancel
      </Button>
      <Button type="submit" className="button primary small" disabled={c.working || c.loading}>
        {c.working ? <LoaderCircle className="spin" size={14} aria-hidden="true" /> : null}
        {c.skill ? 'Save' : 'Add skill'}
        <kbd className="skills-kbd" aria-hidden="true">
          {/Mac|iPhone|iPad/u.test(navigator.platform) ? '⌘S' : 'Ctrl+S'}
        </kbd>
      </Button>
    </footer>
  );
};
