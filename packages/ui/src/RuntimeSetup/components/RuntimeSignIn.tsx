import { Button } from '@pitchcrew/design-system/button';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { RuntimeConnectionSettings } from '@/RuntimeConnectionSettings/index.tsx';
import { RuntimeAccountDetails } from './RuntimeAccountDetails.tsx';
import type { RuntimeSignInProps } from '../types.ts';
import { NativeSignIn } from './NativeSignIn.tsx';
import { authInProgress } from '../helpers.ts';

export const RuntimeSignIn = ({
  runtime,
  auth,
  request,
  working,
  active,
  busy,
  visible,
  onConnectionDirty,
  onConnectionWorking,
  connectionDirty,
  connectionRevision,
  onConnectionSaved,
  refreshSetup,
}: RuntimeSignInProps) => {
  const results =
    useWorkspaceStore((store) => store.data?.runtimeMaintenance?.authentication)?.filter(
      (entry) => entry.runtime === runtime.id,
    ) ?? [];
  const signing = authInProgress(auth);
  const recovery = !!runtime.configurationError || !!auth.configurationError;
  const signedIn =
    !!results.length && results.every((entry) => entry.result.status === 'authenticated');
  return (
    <div className="settings-stack">
      <h3>
        {recovery
          ? 'Recover authentication settings'
          : signedIn
            ? 'Your account is connected'
            : 'Connect your account'}
      </h3>
      <p className="quiet">
        {recovery
          ? 'Your installation is kept. Recover the saved settings below before signing in or starting work.'
          : 'Connect through a supported CLI sign-in method or save credentials for this runtime. Account checks do not generate an AI reply.'}
      </p>
      {!recovery ? (
        <NativeSignIn
          auth={auth}
          request={request}
          working={working}
          disabled={working || active || busy || connectionDirty || !runtime.available}
          signedIn={signedIn}
          visible={visible}
          revision={connectionRevision}
          methodsSettled={refreshSetup}
        >
          <Button
            variant={auth.stage === 'completed' && !signedIn ? 'default' : 'outline'}
            disabled={working || active || !runtime.available}
            onClick={() => void request('/recheck')}
          >
            Recheck sign-in
          </Button>
        </NativeSignIn>
      ) : null}
      {connectionDirty ? (
        <p className="quiet">Save or discard your credential changes before starting sign-in.</p>
      ) : null}
      {!runtime.available && !recovery ? (
        <p className="quiet">Finish installing a compatible runtime before signing in.</p>
      ) : null}
      {!signing ? (
        <>
          <RuntimeConnectionSettings
            runtime={runtime.id}
            blocked={working || active || busy}
            onDirtyChange={onConnectionDirty}
            onWorkingChange={onConnectionWorking}
            onSaved={onConnectionSaved}
            recovery={recovery}
          />
          {!recovery ? <RuntimeAccountDetails runtime={runtime.id} /> : null}
        </>
      ) : null}
    </div>
  );
};
