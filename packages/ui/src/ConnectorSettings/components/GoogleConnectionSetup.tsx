import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { GoogleCredentials } from '@/ConnectorSettings/components/GoogleCredentials.tsx';
import { GoogleInstructions } from '@/ConnectorSettings/components/GoogleInstructions.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { GoogleConnectionSetupProps } from '@/ConnectorSettings/types.ts';

export function GoogleConnectionSetup(props: GoogleConnectionSetupProps) {
  const { google, customGoogle, setCustomGoogle, setEditing, working } = props;
  return (
    <>
      <p className="modal-intro">
        Choose your Google account in your browser and allow the services you want your crew to
        read. Pitchcrew cannot send email or change your Google files or calendar.
      </p>
      {!google?.configured ? (
        <p className="info-note">
          Google sign-in is not configured in this installation. The person who manages Pitchcrew
          needs to finish setup. Advanced setup also offers Workspace CLI or your own Google app.
        </p>
      ) : null}
      <Collapsible open={customGoogle} onOpenChange={setCustomGoogle}>
        <CollapsibleTrigger className="button">Advanced setup</CollapsibleTrigger>
        <CollapsibleContent>
          {customGoogle ? (
            <div className="flex flex-col gap-4 pt-4">
              <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <p>Already use Google Workspace CLI?</p>
                <Button
                  className="button"
                  disabled={working}
                  onClick={() => setEditing('google-cli')}
                >
                  Use Workspace CLI
                </Button>
                <p className="quiet">Connect its saved login without copying credentials.</p>
              </div>
              <GoogleInstructions />
              <GoogleCredentials {...props} />
            </div>
          ) : null}
        </CollapsibleContent>
      </Collapsible>
      <p className="quiet">
        After connecting, choose which agents can use each service in Crew. Sign-in credentials are
        saved on this device and never included in agent prompts.
      </p>
    </>
  );
}
