import { useState, type ReactNode } from 'react';
import type { RuntimeAuthMethod, RuntimeAuthState } from '@pitchcrew/core';
import { Button } from '@pitchcrew/design-system/button';
import { AuthMethodPicker } from './AuthMethodPicker.tsx';
import { AuthLogout } from './AuthLogout.tsx';
import type { RuntimeSetupRequest } from '../types.ts';

export const AuthStart = ({
  auth,
  methods,
  request,
  disabled,
  signedIn,
  children,
  started,
}: {
  auth: RuntimeAuthState;
  methods: RuntimeAuthMethod[];
  request: RuntimeSetupRequest;
  disabled: boolean;
  signedIn: boolean;
  children: ReactNode;
  started: (requested: boolean) => void;
}) => {
  const [choice, setChoice] = useState('');
  const method = methods.find((method) => method.id === choice) ?? methods[0];
  const supported = !!method && method.kind !== 'external';
  return (
    <>
      <AuthMethodPicker
        methods={methods}
        selected={method?.id ?? ''}
        change={setChoice}
        disabled={disabled}
      />
      {supported ? (
        <p className="quiet">
          {auth.credentialScope === 'workspace'
            ? 'This sign-in belongs to this Pitchcrew workspace.'
            : 'Signing in can change the account used by this CLI outside Pitchcrew.'}
        </p>
      ) : (
        <p className="settings-callout">
          This runtime does not advertise an in-app sign-in method. Configure credentials below or
          follow its CLI instructions, then recheck.
        </p>
      )}
      <div className="settings-row-actions">
        {supported ? (
          <Button
            id="runtime-auth-start"
            variant={signedIn || auth.stage === 'completed' ? 'outline' : 'default'}
            disabled={disabled}
            onClick={() => {
              started(true);
              void request('/auth/start', { methodId: method.id }).then((ok) => {
                if (!ok) started(false);
              });
            }}
          >
            {['failed', 'cancelled'].includes(auth.stage)
              ? 'Retry sign-in'
              : signedIn
                ? 'Use a different account'
                : method.label}
          </Button>
        ) : null}
        {children}
        {auth.canLogout ? (
          <AuthLogout
            request={request}
            disabled={disabled}
            workspace={auth.credentialScope === 'workspace'}
            runtime={auth.runtime}
          />
        ) : null}
      </div>
    </>
  );
};
