import { RotateCw, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/index.tsx';
import { FormSelect } from '@/FormSelect/index.tsx';
import {
  browserDevices,
  boundedBrowserDimension,
  type BrowserViewportSetting,
} from './viewport.ts';

export const BrowserDeviceToolbar = ({
  setting,
  change,
  close,
  disabled,
}: {
  setting: BrowserViewportSetting;
  change: (setting: BrowserViewportSetting) => void;
  close: () => void;
  disabled: boolean;
}) => {
  const current =
    setting.mode === 'fixed' ? setting : { name: 'Responsive', width: 1280, height: 800 };
  const dimension = (axis: 'width' | 'height', value: number) =>
    change({
      ...current,
      mode: 'fixed',
      name: 'Custom',
      [axis]: boundedBrowserDimension(value, axis),
    });
  return (
    <div className="browser-device-toolbar flex flex-wrap items-center gap-2 px-3 py-2">
      <Smartphone size={14} aria-hidden="true" />
      <FormSelect
        className="w-40 [&>label]:sr-only"
        label="Browser viewport preset"
        value={setting.mode === 'fill' ? 'fill' : current.name}
        disabled={disabled}
        options={[
          { value: 'fill', label: 'Fill panel' },
          ...browserDevices.map((device) => ({ value: device.name, label: device.name })),
          ...(current.name === 'Custom' ? [{ value: 'Custom', label: 'Custom' }] : []),
        ]}
        onValueChange={(name) => {
          const device = browserDevices.find((item) => item.name === name);
          change(device ? { ...device, mode: 'fixed' } : { mode: 'fill' });
        }}
      />
      <Input
        className="w-20"
        type="number"
        aria-label="Browser viewport width"
        min={240}
        max={2560}
        value={current.width}
        disabled={disabled || setting.mode === 'fill'}
        onChange={(event) => dimension('width', event.currentTarget.valueAsNumber)}
      />
      <span aria-hidden="true">×</span>
      <Input
        className="w-20"
        type="number"
        aria-label="Browser viewport height"
        min={160}
        max={2160}
        value={current.height}
        disabled={disabled || setting.mode === 'fill'}
        onChange={(event) => dimension('height', event.currentTarget.valueAsNumber)}
      />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Rotate browser viewport"
        disabled={disabled || setting.mode === 'fill'}
        onClick={() =>
          change({
            mode: 'fixed',
            name: 'Custom',
            width: boundedBrowserDimension(current.height, 'width'),
            height: boundedBrowserDimension(current.width, 'height'),
          })
        }
      >
        <RotateCw size={14} />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Hide device toolbar" onClick={close}>
        <X size={14} />
      </Button>
    </div>
  );
};
