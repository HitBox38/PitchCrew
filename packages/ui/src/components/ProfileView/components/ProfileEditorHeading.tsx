import type { ProfileViewModel } from '../types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { TabsList, TabsTrigger } from '@/components/ui/tabs/index.tsx';
import { Eye, PencilLine, Save } from 'lucide-react';

export function ProfileEditorHeading(c: ProfileViewModel) {
  return (
    <div className="profile-editor-heading flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2">
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
      <TabsList aria-label="Note editor mode" className="profile-mode-tabs">
        <TabsTrigger value="write">
          <PencilLine size={14} /> Write
        </TabsTrigger>
        <TabsTrigger value="preview">
          <Eye size={14} /> Preview
        </TabsTrigger>
      </TabsList>
      <Button type="submit" className="button primary small" disabled={c.working}>
        <Save size={14} /> {c.working ? 'Saving…' : 'Save note'}
      </Button>
    </div>
  );
}
