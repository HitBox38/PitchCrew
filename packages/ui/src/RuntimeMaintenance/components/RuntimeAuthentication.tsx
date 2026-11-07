import type { RuntimeAuthentication as Authentication } from '@pitchcrew/core';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import { settingsTime } from '@/lib/settings-time.ts';

export const RuntimeAuthentication = ({
  model,
  result,
}: {
  model: string;
  result: Authentication;
}) => {
  const label =
    result.status === 'authenticated'
      ? 'Signed in'
      : result.status === 'missing'
        ? 'Sign-in needed'
        : 'Sign-in not verified';
  return (
    <div className="min-w-0">
      <h4>
        <strong>{model || 'CLI default'}:</strong> {label}
      </h4>
      <p className="quiet">{result.detail}</p>
      <p className="quiet">Checked {settingsTime(result.checkedAt)}</p>
      {result.status !== 'authenticated' ? (
        <div>
          <p className="quiet mt-2">{result.instructions}</p>
          {result.command ? <SourceBlock value={result.command} label="Sign-in command" /> : null}
        </div>
      ) : null}
    </div>
  );
};
