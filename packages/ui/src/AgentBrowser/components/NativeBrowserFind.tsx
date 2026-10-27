import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { X, ArrowDown, ArrowUp } from 'lucide-react';
export const NativeBrowserFind = ({ id, close }: { id: string; close: () => void }) => {
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    return () => {
      void window.pitchcrewBrowser?.find(id, '', true).catch(() => {});
    };
  }, [id]);
  const find = (forward: boolean) =>
    void window.pitchcrewBrowser?.find(id, text, forward).catch(() => {});
  return (
    <form
      className="flex items-center gap-1 border-b border-border px-3 py-2"
      onSubmit={(event) => {
        event.preventDefault();
        find(true);
      }}
    >
      <Input
        ref={input}
        aria-label="Find on page"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          void window.pitchcrewBrowser?.find(id, event.target.value, true).catch(() => {});
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') close();
        }}
      />
      <Button size="icon-sm" aria-label="Previous match" onClick={() => find(false)}>
        <ArrowUp size={14} />
      </Button>
      <Button size="icon-sm" aria-label="Next match" type="submit">
        <ArrowDown size={14} />
      </Button>
      <Button size="icon-sm" aria-label="Close page search" onClick={close}>
        <X size={14} />
      </Button>
    </form>
  );
};
