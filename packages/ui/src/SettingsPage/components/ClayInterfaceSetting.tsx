import { useDevicePreferences } from '@/lib/device-preferences.ts';
import { Switch } from '@/components/ui/switch/index.tsx';

export const ClayInterfaceSetting = () => {
  const clayInterface = useDevicePreferences((state) => state.clayInterface);
  const setClayInterface = useDevicePreferences((state) => state.setClayInterface);
  return (
    <label className="settings-row" htmlFor="clay-interface" aria-label="Clay interface preview">
      <span>
        <strong>Clay interface preview</strong>
        <span className="quiet block">
          Try the new board, sidebar and crew layout. Turn it off to return to the classic one.
        </span>
      </span>
      <Switch
        id="clay-interface"
        aria-label="Clay interface preview"
        checked={clayInterface}
        onCheckedChange={setClayInterface}
      />
    </label>
  );
};
