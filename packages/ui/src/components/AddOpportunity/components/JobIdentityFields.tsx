import { Input } from '@/components/ui/input/components/Input.tsx';
import type { Card } from '@pitchcrew/core';

export const JobIdentityFields = ({ card }: { card?: Card }) => (
  <div className="add-job-pair">
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
