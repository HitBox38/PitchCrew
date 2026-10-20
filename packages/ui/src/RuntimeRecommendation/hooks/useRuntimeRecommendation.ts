import { useEffect, useRef, useState } from 'react';
import type { RuntimeConfiguration, RuntimeRecommendation } from '@pitchcrew/core';
import { loadRuntimeRecommendation } from '../api.ts';

export const useRuntimeRecommendation = (
  roleId: string,
  configuration: RuntimeConfiguration,
  apply: (configuration: RuntimeConfiguration) => void,
) => {
  const recommend = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setChecking(true);
    setError('');
    setRecommendation(null);
    try {
      const result = await loadRuntimeRecommendation(roleId, controller.signal);
      if (controller.signal.aborted) return;
      const current = latestConfiguration.current;
      if (
        current.runtime !== configuration.runtime ||
        current.model !== configuration.model ||
        current.reasoning !== configuration.reasoning
      )
        throw new Error('Runtime settings changed while checking. Try again to replace them.');
      setRecommendation(result);
      apply(result);
    } catch (error) {
      if (!controller.signal.aborted)
        setError(error instanceof Error ? error.message : 'Could not check runtimes.');
    } finally {
      if (!controller.signal.aborted) setChecking(false);
    }
  };

  const request = useRef<AbortController | null>(null);
  const latestConfiguration = useRef(configuration);
  const { runtime, model, reasoning } = configuration;
  useEffect(() => {
    latestConfiguration.current = { runtime, model, reasoning };
  }, [runtime, model, reasoning]);
  const [checking, setChecking] = useState(false);
  const [recommendation, setRecommendation] = useState<RuntimeRecommendation | null>(null);
  const [error, setError] = useState('');
  useEffect(() => () => request.current?.abort(), [roleId]);
  return { checking, recommendation, error, recommend };
};
