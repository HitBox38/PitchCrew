import type { RuntimeAuthentication as Authentication } from '@pitchcrew/core';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible/index.tsx';

export const RuntimeAuthentication = ({
  model,
  result,
}: {
  model: string;
  result: Authentication;
}) => {
  const label =
    result.status === 'authenticated'
      ? 'Authentication confirmed'
      : result.status === 'missing'
        ? 'Authentication needed'
        : 'Authentication unverified';
  return (
    <div className="min-w-0 space-y-1 text-sm">
      <p>
        <strong>{model || 'CLI default'}:</strong> {label}
      </p>
      <p className="quiet">{result.detail}</p>
      <p className="quiet">Checked {new Date(result.checkedAt).toLocaleString()}</p>
      {result.status !== 'authenticated' ? (
        <Collapsible>
          <CollapsibleTrigger className="text-sm underline">Setup instructions</CollapsibleTrigger>
          <CollapsibleContent>
            <p className="quiet mt-2">{result.instructions}</p>
            {result.command ? <SourceBlock value={result.command} label="Sign-in command" /> : null}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
};
