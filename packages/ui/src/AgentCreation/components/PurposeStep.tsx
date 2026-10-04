import type { StepProps, CreationController } from '../types.ts';
import { workflowOptions } from '../constants.ts';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { Textarea } from '@/components/ui/textarea/components/Textarea.tsx';
import { FormSelect } from '@/FormSelect/index.tsx';

export function PurposeStep({
  draft,
  changeRole,
  changeName,
}: StepProps & Pick<CreationController, 'changeName'>) {
  const role = draft.role;
  return (
    <div className="flex flex-col gap-5">
      <label htmlFor="agent-name">
        Agent name
        <Input
          id="agent-name"
          required
          maxLength={80}
          value={role.name}
          onChange={(event) => changeName(event.target.value)}
          placeholder="Research partner"
        />
      </label>
      <label htmlFor="agent-description">
        What is this agent responsible for?
        <Textarea
          id="agent-description"
          className="min-h-24"
          required
          rows={3}
          maxLength={500}
          value={role.description}
          onChange={(event) => changeRole({ description: event.target.value })}
          placeholder="Describe the work it owns and the result you expect."
        />
      </label>
      <label htmlFor="agent-instructions">
        How should it work? <span className="quiet font-normal">Optional</span>
        <Textarea
          id="agent-instructions"
          className="min-h-32"
          rows={5}
          maxLength={12000}
          value={role.instructions}
          onChange={(event) => changeRole({ instructions: event.target.value })}
          placeholder="Describe its process, evidence standards, when to ask you, and what a good result looks like."
        />
      </label>
      <div className="grid grid-cols-2 gap-4 max-compact:grid-cols-1">
        <div className="field">
          <FormSelect
            label="Application workflow action"
            id="agent-workflow"
            value={role.workflow ?? 'chat'}
            onValueChange={(workflow) => changeRole({ workflow: workflow as RoleWorkflow })}
            options={workflowOptions}
          />
          <span className="quiet font-normal">
            Chat and tools works for any responsibility. Choose a workflow action only if it
            evaluates, drafts or reviews applications.
          </span>
        </div>
        <label htmlFor="agent-id">
          Stable role ID
          <Input
            id="agent-id"
            required
            maxLength={48}
            value={role.id}
            onChange={(event) => changeRole({ id: event.target.value })}
          />
          <span className="quiet font-normal">
            Lowercase letters, numbers and hyphens. This ID stays with the agent and its history.
          </span>
        </label>
      </div>
    </div>
  );
}
type RoleWorkflow = StepProps['draft']['role']['workflow'];
