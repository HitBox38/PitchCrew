import { Modal } from '@/components/Modal/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { GoogleConnectionSetup } from '@/ConnectorSettings/components/GoogleConnectionSetup.tsx';
import { GithubConnectionDialog } from './GithubConnectionDialog.tsx';
import { GoogleCliConnectionDialog } from './GoogleCliConnectionDialog.tsx';
import type { ConnectAccountDialogProps } from '@/ConnectorSettings/types.ts';

export function ConnectAccountDialog(props: ConnectAccountDialogProps) {
  const { editing, close, connect, google, error, working, customGoogle, clientId } = props;
  if (editing === 'github') return <GithubConnectionDialog {...props} />;
  if (editing === 'google-cli') return <GoogleCliConnectionDialog {...props} />;
  return (
    <Modal title="Connect Google" onClose={close}>
      <form className="form flex flex-col gap-4" onSubmit={(e) => void connect(e)}>
        <GoogleConnectionSetup {...props} />
        {error ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : null}
        <div className="form-footer mt-0.5 flex justify-end gap-2.5 border-t border-border pt-4">
          <Button className="button" disabled={working} onClick={close}>
            Cancel
          </Button>
          <Button
            className="button primary"
            type="submit"
            disabled={working || (customGoogle ? !clientId.trim() : !google?.configured)}
          >
            {working ? 'Connecting…' : 'Start Google sign-in'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
