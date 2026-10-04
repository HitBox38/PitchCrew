import { Button } from '@/components/ui/button/index.tsx';

export function PickerActions({
  required,
  value,
  valid,
  onValueChange,
  close,
}: {
  required?: boolean;
  value: string;
  valid: boolean;
  onValueChange(value: string): void;
  close(): void;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-border p-3">
      {!required && value ? (
        <Button
          className="button small"
          onClick={() => {
            onValueChange('');
            close();
          }}
        >
          Clear
        </Button>
      ) : null}
      <Button className="button primary small" disabled={!valid} onClick={close}>
        Done
      </Button>
    </div>
  );
}
