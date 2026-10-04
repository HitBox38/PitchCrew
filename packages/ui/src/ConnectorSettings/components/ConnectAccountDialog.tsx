import { Modal } from '@/components/Modal/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { GoogleCredentials } from '@/ConnectorSettings/components/GoogleCredentials.tsx';
import { GoogleInstructions } from '@/ConnectorSettings/components/GoogleInstructions.tsx';
import { GithubConnectionDialog } from './GithubConnectionDialog.tsx';
import type { ConnectAccountDialogProps } from '@/ConnectorSettings/types.ts';

export function ConnectAccountDialog(props: ConnectAccountDialogProps) {
  const { editing, close, connect, google, error, working } = props;
  if (editing === 'github') return <GithubConnectionDialog {...props} />;
  return (
    <Modal title="Connect Google Workspace" onClose={close}>
      <form className="form flex flex-col gap-4" onSubmit={(e) => void connect(e)}>
        <GoogleInstructions />
        {!google?.configured ? <GoogleCredentials {...props} /> : null}
        <p className="quiet">
          The browser will ask for read permissions. You can decline individual services. Connector
          credentials are stored in your local data directory and never included in agent prompts.
        </p>
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
            {working ? 'Connecting…' : 'Start Google sign-in'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
