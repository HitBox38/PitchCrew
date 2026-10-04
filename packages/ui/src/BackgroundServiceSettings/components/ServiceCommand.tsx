import { Button } from '@/components/ui/button/components/Button.tsx';
import { copyText } from '@/lib/clipboard.ts';
import { Copy, SquareTerminal } from 'lucide-react';

export function ServiceCommand({ command }: { command: string }) {
  return (
    <div className="settings-directory mt-3">
      <SquareTerminal size={20} aria-hidden="true" />
      <code className="min-w-0 flex-1 wrap-anywhere">{command}</code>
      <Button className="button" onClick={() => copyText(command, 'Copied the command')}>
        <Copy size={15} /> Copy
      </Button>
    </div>
  );
}
