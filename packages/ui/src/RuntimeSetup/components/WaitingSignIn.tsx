import type { RuntimeAuthState } from '@pitchcrew/core';
import { useState } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import type { RuntimeSetupRequest } from '../types.ts';
import { AuthInteraction } from './AuthInteraction.tsx';
import { AuthOpenLink } from './AuthOpenLink.tsx';
import { SignInExpiry } from './SignInExpiry.tsx';
import { useSignInFocus } from '../hooks/useSignInFocus.ts';
import { useSignInRemaining } from '../hooks/useSignInRemaining.ts';
export const WaitingSignIn = ({
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
  const seconds = useSignInRemaining(auth.stage === 'waiting' ? auth.expiresAt : null);
  const expired = seconds === 0;
  const interactionId = auth.interaction?.id ?? auth.id;
  const [opened, setOpened] = useState<string | null>(null);
  useSignInFocus(!!auth.codeRequested, visible && !working, 'runtime-auth-cancel');
  return (
    <>
      {opened && opened === interactionId ? (
        <output className="quiet" aria-live="polite">
          Sign-in page requested. Complete sign-in in your browser, then return here.
        </output>
      ) : null}
      <div className="settings-row-actions">
        {!expired ? (
          <AuthOpenLink
            key={auth.interaction?.id ?? auth.id}
            auth={auth}
            request={request}
            working={working}
            opened={() => setOpened(interactionId)}
          />
        ) : null}
        <Button
          id="runtime-auth-cancel"
          variant="outline"
          disabled={working}
          onClick={() => void request('/auth/cancel', { flowId: auth.id })}
        >
          Cancel sign-in
        </Button>
      </div>
      {seconds !== null ? <SignInExpiry seconds={seconds} /> : null}
      {!expired ? (
        <AuthInteraction auth={auth} request={request} working={working} visible={visible} />
      ) : null}
      <p className="quiet">
        Sign-in keeps waiting if you close this panel. Return here to continue or cancel.
      </p>
    </>
  );
};
