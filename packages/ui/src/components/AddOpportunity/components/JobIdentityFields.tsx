import { Input } from '@/components/ui/input/components/Input.tsx';

export function JobIdentityFields() {
  return (
    <div className="form-row">
      <label>
        Company
        <Input
          name="company"
          required
          maxLength={100}
          placeholder="e.g. Linear"
          autoComplete="organization"
        />
      </label>
      <label>
        Role title
        <Input name="title" required maxLength={160} placeholder="e.g. Senior Frontend Engineer" />
      </label>
    </div>
  );
}
