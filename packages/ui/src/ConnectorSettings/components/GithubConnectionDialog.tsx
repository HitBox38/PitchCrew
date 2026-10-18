import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import { ExternalLink, GitBranch } from 'lucide-react';
import { Modal } from '@/components/Modal/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { GithubTokenForm } from './GithubTokenForm.tsx';
import type { ConnectAccountDialogProps } from '../types.ts';

export function GithubConnectionDialog(props: ConnectAccountDialogProps) {
  const { close, connectGithubCli, github, error, working } = props;
  return (
    <Modal title="Connect GitHub" onClose={close}>
      <div className="flex flex-col gap-5">
        <p className="modal-intro">
          Already signed in to GitHub CLI? Connect below to use that account. PitchCrew reads your
          repositories, files, issues and pull requests.
        </p>
        <Button
          className="button primary self-start"
          disabled={working}
          onClick={() => void connectGithubCli()}
        >
          <GitBranch size={16} /> {working ? 'Checking connection…' : 'Connect with GitHub CLI'}
        </Button>
        <AccordionSection
          key={github?.githubCliState ?? 'unknown'}
          className="rounded-lg border border-border bg-muted p-4"
          defaultOpen={
            github?.githubCliState === 'missing' || github?.githubCliState === 'signed_out'
          }
          triggerClassName="cursor-pointer"
          heading="Need to set up GitHub CLI?"
        >
          <ol className="mt-3 flex list-decimal flex-col gap-3 pl-5">
            <li>
              <a
                className="inline-flex items-center gap-1 underline underline-offset-4"
                href="https://cli.github.com/"
                target="_blank"
                rel="noreferrer"
              >
                Install GitHub CLI <ExternalLink size={14} />
              </a>
              <p className="quiet">
                After installing, restart PitchCrew so it can find the command.
              </p>
            </li>
            <li>
              Open a terminal and run:
              <SourceBlock
                label="GitHub sign-in command"
                value="gh auth login --hostname github.com --web"
              />
              <p className="quiet">Follow the prompts to sign in through your browser.</p>
            </li>
            <li>Return here and choose Connect with GitHub CLI.</li>
          </ol>
        </AccordionSection>
        <p className="quiet">
          Credentials stay with GitHub CLI. PitchCrew only makes read requests. GitHub CLI access
          follows your login and can cover more than one repository.
        </p>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <AccordionSection
          className="border-t border-border pt-3"
          triggerClassName="cursor-pointer text-sm text-muted-foreground"
          heading="Advanced: use an access token"
        >
          <GithubTokenForm {...props} />
        </AccordionSection>
        <div className="flex justify-end">
          <Button className="button" disabled={working} onClick={close}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
