import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pitchcrew/design-system/select';
import type { SkillFilter, SkillsViewModel } from '@/SkillsView/types.ts';

/** One bounded select replaces the per-agent chip row; the value stays URL-backed. */
export const SkillAgentSelect = ({ data, filter, onFilter }: SkillsViewModel) => {
  const options: { value: SkillFilter; label: string }[] = [
    { value: 'all', label: 'All agents' },
    { value: 'shared', label: 'Shared only' },
    ...data.roles
      .filter((role) => !role.retiredAt || role.id === filter)
      .map((role) => ({ value: role.id, label: role.name })),
  ];
  return (
    <Select
      value={filter}
      items={options}
      onValueChange={(next) => {
        if (next !== null) onFilter(next);
      }}
    >
      <SelectTrigger className="skills-agent-select" aria-label="Filter skills by agent" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start" sideOffset={6}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
