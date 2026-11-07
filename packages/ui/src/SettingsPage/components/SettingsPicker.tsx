import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@pitchcrew/design-system/select';
import { settingsSections } from '../constants.ts';
import { validateSettingsSearch } from '../helpers.ts';

export const SettingsPicker = () => {
  const { section } = useSearch({ from: '/settings' });
  const navigate = useNavigate({ from: '/settings' });
  return (
    <Select
      value={section}
      items={settingsSections.map(({ id, label }) => ({ value: id, label }))}
      onValueChange={(value) => {
        if (value) void navigate({ search: validateSettingsSearch({ section: value }), hash: '' });
      }}
    >
      <SelectTrigger className="settings-picker" aria-label="Settings section">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {['Preferences', 'Connections', 'System'].map((group) => (
          <SelectGroup key={group}>
            <SelectLabel>{group}</SelectLabel>
            {settingsSections
              .filter((item) => item.group === group)
              .map(({ id, label }) => (
                <SelectItem key={id} value={id}>
                  {label}
                </SelectItem>
              ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
};
