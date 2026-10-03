import type { RoleSettingsModel } from '../types.ts';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { Textarea } from '@/components/ui/textarea/components/Textarea.tsx';
import { Select } from '@/components/ui/select/constants.ts';
import { SelectTrigger } from '@/components/ui/select/components/SelectTrigger.tsx';
import { SelectValue } from '@/components/ui/select/components/SelectValue.tsx';
import { SelectContent } from '@/components/ui/select/components/SelectContent.tsx';
import { SelectItem } from '@/components/ui/select/components/SelectItem.tsx';
const seats = [
  { value: 'chat', label: 'Chat and scoped tools' },
  { value: 'scout', label: 'Evaluate job fit' },
  { value: 'writer', label: 'Draft application packets' },
  { value: 'reviewer', label: 'Review application packets' },
];
export function IdentitySettings({
  creating,
  id,
  setId,
  name,
  setName,
  description,
  setDescription,
  workflow,
  setWorkflow,
}: RoleSettingsModel) {
  return (
    <section className="role-settings-section">
      <h3>Responsibilities and actions</h3>
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
          <p className="quiet">
            Lowercase letters, numbers and hyphens. This ID stays with the role and its history.
          </p>
        </div>
      ) : (
        <p className="quiet">Role ID: {id}</p>
      )}
      <div className="field">
        <label htmlFor="role-name">Name</label>
        <Input
          id="role-name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="role-responsibility">Responsibilities</label>
        <Textarea
          id="role-responsibility"
          required
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="role-workflow">Application workflow action</label>
        <Select
          items={seats}
          value={workflow}
          onValueChange={(value) => value && setWorkflow(value as typeof workflow)}
        >
          <SelectTrigger id="role-workflow">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {seats.map((seat) => (
              <SelectItem key={seat.value} value={seat.value}>
                {seat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="quiet">
        Capabilities below control tools separately. Browser interactions and exports require your
        approval. New roles have connected services and crew actions disabled until you enable them.
      </p>
    </section>
  );
}
