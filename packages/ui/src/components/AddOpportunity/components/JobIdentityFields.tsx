import { Input } from '@/components/ui/input/components/Input.tsx';
import type { Card } from '@pitchcrew/core';

export const JobIdentityFields = ({ card }: { card?: Card }) => {
  return (
    <div className="form-row grid grid-cols-2 gap-3.5 max-compact:grid-cols-1">
      <label>
        Company
        <Input
          name="company"
          defaultValue={card?.company}
          required
          maxLength={100}
          placeholder="e.g. Linear"
          autoComplete="organization"
        />
      </label>
      <label>
        Role title
        <Input
          name="title"
          defaultValue={card?.title}
          required
          maxLength={160}
          placeholder="e.g. Senior Frontend Engineer"
        />
      </label>
    </div>
  );
};
