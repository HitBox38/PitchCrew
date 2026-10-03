import { Input } from '@/components/ui/input/components/Input.tsx';

export function JobLocationFields() {
  return (
    <div className="form-row grid grid-cols-2 gap-3.5 max-compact:grid-cols-1">
      <label>
        Location
        <Input
          name="location"
          placeholder="Remote, hybrid, or a city"
          defaultValue="Remote"
          maxLength={120}
        />
      </label>
      <label>
        Salary range <span className="optional">optional</span>
        <Input name="salary" placeholder="e.g. $100k–$130k" maxLength={100} />
      </label>
    </div>
  );
}
