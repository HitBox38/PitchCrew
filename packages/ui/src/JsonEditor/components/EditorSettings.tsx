import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button/index.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog/index.tsx';
import { Switch } from '@/components/ui/switch/index.tsx';
import { useDevicePreferences } from '@/lib/device-preferences.ts';

export const EditorSettings = () => {
  const save = useDevicePreferences((store) => store.jsonFormatOnSave);
  const paste = useDevicePreferences((store) => store.jsonFormatOnPaste);
  const type = useDevicePreferences((store) => store.jsonFormatOnType);
  const setSave = useDevicePreferences((store) => store.setJsonFormatOnSave);
  const setPaste = useDevicePreferences((store) => store.setJsonFormatOnPaste);
  const setType = useDevicePreferences((store) => store.setJsonFormatOnType);
  const options = [
    {
      id: 'json-format-on-save',
      label: 'Format on save',
      description: 'Format JSON when you save the rules.',
      checked: save,
      change: setSave,
    },
    {
      id: 'json-format-on-paste',
      label: 'Format on paste',
      description: 'Format valid JSON after pasting into the editor.',
      checked: paste,
      change: setPaste,
    },
    {
      id: 'json-format-on-type',
      label: 'Format while typing',
      description: 'Format valid JSON as you type. Incomplete JSON stays editable.',
      checked: type,
      change: setType,
    },
  ];
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            id="json-editor-settings"
            variant="outline"
            size="icon-sm"
            aria-label="JSON editor settings"
            title="JSON editor settings"
          />
        }
      >
        <Settings2 size={15} aria-hidden="true" />
      </DialogTrigger>
      <DialogContent className="json-editor-settings sm:max-w-md">
        <DialogTitle>JSON editor settings</DialogTitle>
        <DialogDescription>
          Formatting preferences save automatically on this device.
        </DialogDescription>
        <div className="grid gap-4">
          {options.map((option) => (
            <label
              key={option.id}
              htmlFor={option.id}
              className="flex items-center justify-between gap-5"
            >
              <span>
                <span id={`${option.id}-label`} className="block text-sm font-semibold">
                  {option.label}
                </span>
                <span
                  id={`${option.id}-description`}
                  className="block text-xs text-muted-foreground"
                >
                  {option.description}
                </span>
              </span>
              <Switch
                id={option.id}
                checked={option.checked}
                onCheckedChange={option.change}
                aria-labelledby={`${option.id}-label`}
                aria-describedby={`${option.id}-description`}
              />
            </label>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
