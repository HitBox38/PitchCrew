import { Button } from '@/components/ui/button/components/Button.tsx';
import { copyDataDirectory } from '@/lib/data-directory.ts';
import { Copy, Folder } from 'lucide-react';

export function DataSettings({ directory }: { directory: string }) {
  return (
    <section className="settings-section" aria-labelledby="data-heading">
      <h2 id="data-heading">Saved on this device</h2>
      <p className="quiet">Your board, profile notes, chats and packets live in this folder.</p>
      <div className="settings-directory">
        <Folder size={20} aria-hidden="true" />
        <code className="min-w-0 flex-1 wrap-anywhere">{directory}</code>
        <Button className="button" onClick={() => copyDataDirectory(directory)}>
          <Copy size={15} /> Copy path
        </Button>
      </div>
      <p className="info-note">Keep this folder when moving or backing up your workspace.</p>
    </section>
  );
}
