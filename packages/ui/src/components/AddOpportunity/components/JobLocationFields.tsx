import { Input } from '@/components/ui/input/components/Input.tsx';
import type { Card } from '@pitchcrew/core';

export const JobLocationFields = ({ card }: { card?: Card }) => {
  return (
    <div className="form-row grid grid-cols-2 gap-3.5 max-compact:grid-cols-1">
      <label>
        Location
        <Input
          name="location"
          placeholder="Remote, hybrid, or a city"
          defaultValue={card?.location ?? 'Remote'}
          maxLength={120}
        />
      </label>
      <label>
        <span className="flex items-baseline gap-2">
          Salary range <span className="optional">optional</span>
        </span>
        <Input
          name="salary"
          defaultValue={card?.salary}
          placeholder="e.g. $100k–$130k"
          maxLength={100}
        />
      </label>
    </div>
  );
};
