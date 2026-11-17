import { Button } from '@pitchcrew/design-system/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@pitchcrew/design-system/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { FormSelect } from '@/FormSelect/index.tsx';
import type { useApplicationBrief } from '../hooks/useApplicationBrief.ts';

type Model = ReturnType<typeof useApplicationBrief>;

/** The first inspection: choose the agent, then a quiet button (the dock's is the glazed one). */
export const FormInspect = ({ model }: { model: Model }) => (
  <div className="flex flex-wrap items-end gap-2">
    {model.formAgents.length ? (
      <FormSelect
        label="Form inspection agent"
        value={model.formRoleId}
        onValueChange={model.setFormRoleId}
        options={model.formAgents.map((role) => ({ value: role.id, label: role.name }))}
      />
    ) : (
      <p className="quiet">Enable an agent with browser and form assessment tools in Crew.</p>
    )}
    <Button
      variant="ghost"
      size="sm"
      disabled={model.disabled || model.editing || !model.formRoleId}
      onClick={() => {
        void model.inspectForm();
      }}
    >
      Inspect application form
    </Button>
  </div>
);

/** Once inspected, a quiet control beside the heading; several agents become a short menu. */
export const InspectAgain = ({ model }: { model: Model }) => {
  const disabled = model.disabled || !model.formRoleId;
  if (model.formAgents.length < 2)
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => {
          void model.inspectForm();
        }}
      >
        Inspect again
      </Button>
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />} disabled={disabled}>
        Inspect again
        <ChevronDown size={14} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44" aria-label="Inspect again with">
        {model.formAgents.map((role) => (
          <DropdownMenuItem
            key={role.id}
            className="min-h-9 pointer-coarse:min-h-11"
            onClick={() => {
              model.setFormRoleId(role.id);
              void model.inspectForm(role.id);
            }}
          >
            With {role.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
