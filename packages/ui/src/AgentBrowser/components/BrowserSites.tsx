import { AccordionSection } from '@pitchcrew/design-system/accordion';
import { Button } from '@pitchcrew/design-system/button';
import { browserCommand } from '../api.ts';
import type { AgentBrowserProps, BrowserControl } from '../types.ts';
export const BrowserSites = ({
  browserPanel,
  thread,
  control,
}: Pick<AgentBrowserProps, 'browserPanel' | 'thread'> & { control: BrowserControl }) => {
  const session = browserPanel.session;
  const sites = [
    ...new Set([...(session?.allowedSites ?? []), ...(session?.explorationSites ?? [])]),
  ];
  if (!session?.runId || !sites.length) return null;
  return (
    <AccordionSection
      className="browser-sites"
      heading={<>Allowed sites for this task ({sites.length})</>}
    >
      {sites.map((origin) => (
        <div className="flex items-center justify-between gap-2" key={origin}>
          <span className="min-w-0 break-all">
            {origin} · {session.allowedSites.includes(origin) ? 'Preparation' : 'Browsing'}
          </span>
          <Button
            size="xs"
            variant="ghost"
            disabled={control.working}
            aria-label={`Revoke access to ${origin}`}
            onClick={() =>
              void control.command(() =>
                browserCommand(session.roleId, thread, 'sites', {
                  taskId: session.taskId,
                  url: origin,
                  allowed: false,
                }),
              )
            }
          >
            Revoke
          </Button>
        </div>
      ))}
    </AccordionSection>
  );
};
