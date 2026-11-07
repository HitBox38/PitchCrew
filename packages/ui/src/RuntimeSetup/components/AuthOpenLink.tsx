import { useState } from 'react';
import type { RuntimeAuthState } from '@pitchcrew/core';
import { Button, buttonVariants } from '@pitchcrew/design-system/button';
import type { RuntimeSetupRequest } from '../types.ts';

export const AuthOpenLink = ({
  auth,
  request,
  working,
  opened,
}: {
  auth: RuntimeAuthState;
  request: RuntimeSetupRequest;
  working: boolean;
  opened: () => void;
}) => {
  const [accepted, setAccepted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const interaction = auth.interaction;
  const url =
    interaction?.type === 'browser' || interaction?.type === 'device' ? interaction.url : auth.url;
  if (!url) return null;
  const consent = interaction?.type === 'browser' && interaction.requiresConsent && !accepted;
  if (consent)
    return (
      <Button
        disabled={working}
        onClick={() => {
          const desktop = !!window.pitchcrewBrowser;
          const popup = desktop ? null : window.open('', '_blank');
          if (popup) popup.opener = null;
          void request('/auth/respond', {
            flowId: auth.id,
            interactionId: interaction.id,
            response: { type: 'browser', action: 'open' },
          }).then((ok) => {
            if (ok) {
              setAccepted(true);
              if (desktop || popup) opened();
              if (desktop) window.open(url, '_blank', 'noopener,noreferrer');
              else if (popup) popup.location.replace(url);
              else setBlocked(true);
            } else popup?.close();
          });
        }}
      >
        Open sign-in page
      </Button>
    );
  const variant =
    accepted || auth.codeRequested || interaction?.type === 'code' ? 'outline' : 'default';
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      referrerPolicy="no-referrer"
      className={buttonVariants({ variant })}
      data-slot="button"
      data-variant={variant}
      data-size="default"
    >
      {blocked
        ? 'Browser blocked the window — open sign-in page'
        : accepted
          ? 'Open sign-in page again'
          : 'Open sign-in page'}
    </a>
  );
};
