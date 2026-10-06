import { Modal } from '@/components/Modal/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { ConnectAccountDialogProps } from '../types.ts';

export function GoogleCliConnectionDialog({
  close,
  connectGoogleCli,
  google,
  error,
  working,
  setEditing,
}: ConnectAccountDialogProps) {
  return (
    <Modal title="Connect Google Workspace CLI" onClose={close}>
      <div className="flex flex-col gap-5">
        <p className="modal-intro">
          Already signed in with gws? Connect its saved Google account to let your crew read Gmail,
          Drive, Docs, Sheets and Calendar. Only services you have granted are available.
        </p>
        <Button
          className="button primary self-start"
          disabled={working}
          onClick={() => void connectGoogleCli()}
        >
          {working ? 'Checking connection…' : 'Connect with Workspace CLI'}
        </Button>
        <details
          className="rounded-lg border border-border bg-muted p-4"
          open={!!google?.googleCliState && google.googleCliState !== 'ready'}
        >
          <summary className="cursor-pointer">Need to set up Workspace CLI?</summary>
          <ol className="mt-3 flex list-decimal flex-col gap-3 pl-5">
            <li>
              <a
                className="underline underline-offset-4"
                href="https://github.com/googleworkspace/cli"
                target="_blank"
                rel="noreferrer"
              >
                Install Google Workspace CLI
              </a>
              <p className="quiet">Restart PitchCrew after installing so it can find gws.</p>
            </li>
            <li>
              Follow the CLI’s setup guide to configure its Google Cloud app, then run:
              <code className="mt-2 block rounded border border-border bg-background p-2 text-sm wrap-anywhere select-all">
                gws auth login --readonly
              </code>
              <p className="quiet">Choose your account and grant the services you want to read.</p>
            </li>
            <li>Return here and choose Connect with Workspace CLI.</li>
          </ol>
        </details>
        <p className="quiet">
          Credentials stay with gws. PitchCrew only makes read requests and checks that the account
          still matches. Disconnecting here keeps your CLI login. Enable services per agent in Crew.
        </p>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button className="button" disabled={working} onClick={() => setEditing('google')}>
            Back
          </Button>
          <Button className="button" disabled={working} onClick={close}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
