import { useEffect, useRef, type ReactNode } from 'react';
import type { RuntimeAuthState } from '@pitchcrew/core';
import { Button } from '@pitchcrew/design-system/button';
import { authInProgress } from '../helpers.ts';
import type { RuntimeSetupRequest } from '../types.ts';
import { WaitingSignIn } from './WaitingSignIn.tsx';
import { useSignInFocus } from '../hooks/useSignInFocus.ts';
import { useAuthMethods } from '../hooks/useAuthMethods.ts';
import { AuthStart } from './AuthStart.tsx';
export const NativeSignIn = ({
  auth,
  request,
  working,
  disabled,
  signedIn,
  visible,
  children,
  revision,
  methodsSettled,
}: {
  auth: RuntimeAuthState;
  request: RuntimeSetupRequest;
  working: boolean;
  disabled: boolean;
  signedIn: boolean;
  visible: boolean;
  children: ReactNode;
  revision: number;
  methodsSettled: () => void;
}) => {
  const requested = useRef(false);
  const discovered = useAuthMethods(
    auth.runtime,
    visible && !auth.configurationError,
    revision,
    methodsSettled,
  );
  const methods = discovered.methods ?? auth.methods ?? [];
  useSignInFocus(authInProgress(auth), visible && !working && !disabled, 'runtime-auth-start');
  useEffect(() => {
    if (
      auth.url &&
      requested.current &&
      window.pitchcrewBrowser &&
      !(auth.interaction?.type === 'browser' && auth.interaction.requiresConsent)
    ) {
      requested.current = false;
      window.open(auth.url, '_blank', 'noopener,noreferrer');
    }
  }, [auth.url, auth.interaction]);
  const signing = authInProgress(auth);
  return (
    <>
      {auth.configurationError ? (
        <p role="alert" className="settings-callout runtime-model-notice">
          {auth.configurationError}
        </p>
      ) : null}
      {auth.stage !== 'idle' ? (
        <output aria-live="polite" className={auth.stage === 'failed' ? 'form-error' : 'quiet'}>
          {auth.stage === 'succeeded' && auth.operation !== 'logout'
            ? signedIn
              ? 'Your current CLI account is connected.'
              : 'The previous sign-in finished. Recheck the current CLI account or sign in again.'
            : auth.detail}
        </output>
      ) : null}
      {signing ? (
        <WaitingSignIn auth={auth} request={request} working={working} visible={visible} />
      ) : (
        <>
          {discovered.error ? (
            <div role="alert" className="form-error">
              <p>{discovered.error}</p>
              <Button variant="outline" size="sm" disabled={disabled} onClick={discovered.retry}>
                Retry sign-in methods
              </Button>
            </div>
          ) : null}
          {discovered.loading && !auth.methods ? (
            <output className="quiet">Finding sign-in methods…</output>
          ) : (
            <AuthStart
              auth={auth}
              methods={methods}
              request={request}
              disabled={disabled || working || !!auth.configurationError}
              signedIn={signedIn}
              started={(value) => {
                requested.current = value;
              }}
            >
              {children}
            </AuthStart>
          )}
        </>
      )}
    </>
  );
};
