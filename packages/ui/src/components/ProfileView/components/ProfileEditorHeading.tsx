import type { ProfileViewModel } from '../types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { MarkdownModeTabs } from '@/components/MarkdownEditor/components/MarkdownModeTabs.tsx';
import { Save } from 'lucide-react';

export const ProfileEditorHeading = (c: ProfileViewModel) => {
  return (
    <div className="profile-editor-heading flex min-h-13 shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-2">
      <label className="sr-only" htmlFor="profile-file">
        Profile filename
      </label>
      <Input
        id="profile-file"
        autoComplete="off"
        name="filename"
        spellCheck={false}
        value={c.name}
        onChange={(event) => c.setName(event.target.value)}
        pattern="[a-zA-Z0-9_.\-]+\.md"
        maxLength={100}
        required
      />
      <MarkdownModeTabs label="Note editor mode" />
      <Button type="submit" className="button primary small" disabled={c.working}>
        <Save size={14} /> {c.working ? 'Saving…' : 'Save note'}
      </Button>
    </div>
  );
};
