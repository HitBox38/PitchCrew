import type { RoleSettingsModel } from '../types.ts';
import { Input } from '@pitchcrew/design-system/input';
import { Textarea } from '@pitchcrew/design-system/textarea';
import { FormSelect } from '@/FormSelect/index.tsx';
import { workflowOptions } from '@/AgentCreation/constants.ts';

/** Name, responsibility and the optional application workflow seat. */
export const IdentitySettings = ({
  creating,
  id,
  setId,
  name,
  setName,
  description,
  setDescription,
  workflow,
  setWorkflow,
}: RoleSettingsModel) => {
  return (
    <section
      className="agent-panel-section"
      id="agent-identity"
      aria-labelledby="agent-identity-heading"
    >
      <h3 id="agent-identity-heading">Identity and responsibility</h3>
      {creating ? (
        <div className="field">
          <label htmlFor="new-role-id">Stable role ID</label>
          <Input
            id="new-role-id"
            required
            maxLength={48}
            placeholder="research-assistant"
            value={id}
            onChange={(e) => setId(e.target.value)}
          />
          <p className="optional">
            Lowercase letters, numbers and hyphens. It stays with the history.
          </p>
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="role-name">Name</label>
        <Input
          id="role-name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {!creating ? <p className="optional">Role ID: {id}</p> : null}
      </div>
      <div className="field">
        <label htmlFor="role-responsibility">Responsibilities</label>
        <Textarea
          id="role-responsibility"
          required
          rows={3}
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <FormSelect
        label="Application workflow action"
        id="role-workflow"
        value={workflow}
        onValueChange={(value) => setWorkflow(value as typeof workflow)}
        options={workflowOptions}
      />
    </section>
  );
};
