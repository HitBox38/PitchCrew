import { Button } from '@/components/ui/button/components/Button.tsx';
import { runtimeLabels } from '@/lib/labels.ts';
import type { RuntimeConfiguration } from '@pitchcrew/core';
import { useRuntimeRecommendation } from './hooks/useRuntimeRecommendation.ts';

interface RuntimeRecommendationProps {
  roleId: string;
  disabled?: boolean;
  configuration: RuntimeConfiguration;
  onApply(configuration: RuntimeConfiguration): void;
}

export function RuntimeRecommendation({
  roleId,
  disabled,
  configuration,
  onApply,
}: RuntimeRecommendationProps) {
  const { checking, recommendation, error, recommend } = useRuntimeRecommendation(
    roleId,
    configuration,
    onApply,
  );
  return (
    <div className="my-4 flex flex-col items-start gap-2">
      <Button
        size="sm"
        className="button small"
        disabled={disabled || checking}
        onClick={() => void recommend()}
      >
        {checking ? 'Checking installed runtimes…' : 'Use recommended setup'}
      </Button>
      <p className="optional" role={error ? 'alert' : 'status'}>
        {error ||
          (recommendation
            ? `${runtimeLabels[recommendation.runtime]} · ${recommendation.model || 'CLI default'}. ${recommendation.detail} Save settings to apply.`
            : 'Checks installed runtimes, models and supported reasoning for this agent.')}
      </p>
    </div>
  );
}
