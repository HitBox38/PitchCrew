import { Modal } from '@/components/Modal/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { GithubInstructions } from '@/ConnectorSettings/components/GithubInstructions.tsx';
import { GoogleCredentials } from '@/ConnectorSettings/components/GoogleCredentials.tsx';
import { GoogleInstructions } from '@/ConnectorSettings/components/GoogleInstructions.tsx';
import type { ConnectAccountDialogProps } from '@/ConnectorSettings/types.ts';

export function ConnectAccountDialog({
  editing,
  close,
  connect,
  token,
  setToken,
  google,
  clientId,
  setClientId,
  clientSecret,
  setClientSecret,
  error,
  working,
}: ConnectAccountDialogProps) {
  return (
    <Modal
      title={editing === 'github' ? 'Connect GitHub' : 'Connect Google Workspace'}
      onClose={close}
    >
      <form className="form flex flex-col gap-4" onSubmit={(e) => void connect(e)}>
        {editing === 'github' ? (
          <>
            <GithubInstructions />
            <label>
              GitHub access token
              <Input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
                required
                maxLength={1000}
              />
            </label>
          </>
        ) : (
          <>
            <GoogleInstructions />
            {!google?.configured ? (
              <GoogleCredentials
                clientId={clientId}
                setClientId={setClientId}
                clientSecret={clientSecret}
                setClientSecret={setClientSecret}
              />
            ) : null}
            <p className="quiet">
              The browser will ask for read permissions. You can decline individual services.
              Connector credentials are stored in your local data directory and never included in
              agent prompts.
            </p>
          </>
        )}
        {error ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : null}
        <div className="form-footer mt-0.5 flex justify-end gap-2.5 border-t border-border pt-4">
          <Button className="button" disabled={working} onClick={close}>
            Cancel
          </Button>
          <Button className="button primary" type="submit" disabled={working}>
            {working
              ? 'Connecting…'
              : editing === 'github'
                ? 'Connect GitHub'
                : 'Start Google sign-in'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
