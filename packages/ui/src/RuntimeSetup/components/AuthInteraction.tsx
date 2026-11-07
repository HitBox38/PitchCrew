import { lazy, Suspense } from 'react';
import type { RuntimeAuthState } from '@pitchcrew/core';
import { AuthCredentials } from './AuthCredentials.tsx';
import { AuthCode } from './AuthCode.tsx';
import type { RuntimeSetupRequest } from '../types.ts';
const AuthTerminal = lazy(() => import('./AuthTerminal.tsx'));

export const AuthInteraction = ({
  auth,
  request,
  working,
  visible,
}: {
  auth: RuntimeAuthState;
  request: RuntimeSetupRequest;
  working: boolean;
  visible: boolean;
}) => {
  if (!auth.id) return null;
  const interaction = auth.interaction;
  if (interaction?.type === 'terminal')
    return (
      <Suspense fallback={<output className="quiet">Opening sign-in terminal…</output>}>
        <AuthTerminal
          key={`${auth.id}:${interaction.id}`}
          runtime={auth.runtime}
          flowId={auth.id}
          interaction={interaction}
          visible={visible}
        />
      </Suspense>
    );
  if (interaction?.type === 'credentials')
    return (
      <AuthCredentials
        key={`${auth.id}:${interaction.id}`}
        flowId={auth.id}
        interaction={interaction}
        request={request}
        working={working}
      />
    );
  if (interaction?.type === 'device')
    return (
      <p className="settings-callout">
        Enter this code on the sign-in page:{' '}
        <strong className="select-all">{interaction.userCode}</strong>
      </p>
    );
  if (interaction?.type === 'code' || auth.codeRequested)
    return (
      <AuthCode
        key={`${auth.id}:${interaction?.id ?? 'legacy'}`}
        flowId={auth.id}
        interactionId={interaction?.id}
        label={interaction?.type === 'code' ? interaction.label : undefined}
        working={working}
        request={request}
        visible={visible}
      />
    );
  return null;
};
