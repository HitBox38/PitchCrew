import { Textarea } from '@/components/ui/textarea/index.tsx';
import type { ExtractedJob } from '@pitchcrew/core';
import { splitLines } from '../helpers.ts';

export const BriefFields = ({
  value,
  change,
}: {
  value: ExtractedJob['brief'];
  change: (value: ExtractedJob['brief']) => void;
}) => {
  return (
    <div className="grid gap-3">
      <label className="grid gap-1">
        Company context
        <Textarea
          value={value.companyContext}
          maxLength={3000}
          onChange={(event) => change({ ...value, companyContext: event.target.value })}
        />
      </label>
      {(['responsibilities', 'qualifications', 'constraints'] as const).map((field) => (
        <label key={field} className="grid gap-1">
          {field[0].toUpperCase() + field.slice(1)}{' '}
          <span className="quiet font-normal">One item per line</span>
          <Textarea
            value={value[field].join('\n')}
            onChange={(event) => change({ ...value, [field]: splitLines(event.target.value) })}
          />
        </label>
      ))}
    </div>
  );
};
