import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { GoogleCredentials } from '@/ConnectorSettings/components/GoogleCredentials.tsx';
import { GoogleInstructions } from '@/ConnectorSettings/components/GoogleInstructions.tsx';
import type { GoogleConnectionSetupProps } from '@/ConnectorSettings/types.ts';

export function GoogleConnectionSetup(props: GoogleConnectionSetupProps) {
  const { google, customGoogle, setCustomGoogle } = props;
  return (
    <>
      <p className="modal-intro">
        Choose your Google account in your browser and allow the services you want your crew to
        read. Pitchcrew cannot send email or change your Google files or calendar.
      </p>
      {!google?.configured ? (
        <p className="info-note">
          Google sign-in is not configured in this installation. The person who manages Pitchcrew
          needs to finish setup. You can also connect using your own Google app below.
        </p>
      ) : null}
      <Collapsible open={customGoogle} onOpenChange={setCustomGoogle}>
        <CollapsibleTrigger className="button">Advanced setup</CollapsibleTrigger>
        <CollapsibleContent>
          {customGoogle ? (
            <div className="flex flex-col gap-4 pt-4">
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
