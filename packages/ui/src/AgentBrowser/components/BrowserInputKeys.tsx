import { Button } from '@/components/ui/button/components/Button.tsx';
import type { BrowserControl } from '../types.ts';
const keys = [
  ['Tab', 'Next field'],
  ['Shift+Tab', 'Previous field'],
  ['Enter', 'Enter'],
  ['Backspace', 'Delete character'],
  ['ControlOrMeta+A', 'Select all'],
  ['Escape', 'Escape on page'],
] as const;
export function BrowserInputKeys({ control }: { control: BrowserControl }) {
  return (
    <div className="browser-input-keys">
      {keys.map(([key, label]) => (
        <Button
          key={key}
          size="sm"
          variant="outline"
          aria-label={label}
          onClick={() => control.input({ kind: 'key', key })}
        >
          {label}
        </Button>
      ))}
      <Button
        size="sm"
        variant="outline"
        onClick={() => control.input({ kind: 'scroll', deltaX: 0, deltaY: -500 })}
      >
        Scroll up
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => control.input({ kind: 'scroll', deltaX: 0, deltaY: 500 })}
      >
        Scroll down
      </Button>
    </div>
  );
}
