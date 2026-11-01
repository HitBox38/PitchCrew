import { useNavigate } from '@tanstack/react-router';
import { Compass } from 'lucide-react';
import { SidebarMenuButton, useSidebar } from '@pitchcrew/design-system/sidebar';
import { setupProgress } from '@/Onboarding/helpers.ts';
import { useOnboarding } from '@/Onboarding/hooks/useOnboarding.ts';

/**
 * “Getting started · 2 of 3 ready” while setup is incomplete. It opens the Board setup checklist,
 * bringing it back if setup was put off; the introduction is in Settings and the command palette.
 */
export const SetupRow = () => {
  const { data, working, save } = useOnboarding();
  const navigate = useNavigate();
  const { setOpenMobile } = useSidebar();
  const status = data?.onboarding?.status;
  if (!data || !status || status === 'completed' || status === 'welcome') return null;
  const steps = Object.entries(setupProgress(data));
  const ready = steps.filter(([, done]) => done).length;
  if (ready === steps.length) return null;
  const label = `Getting started, ${ready} of ${steps.length} ready`;
  return (
    <SidebarMenuButton
      className="sidebar-footer-row sidebar-setup-row"
      tooltip={label}
      aria-label={label}
      disabled={working}
      onClick={async () => {
        setOpenMobile(false);
        if (status !== 'setup') await save('setup', 0);
        await navigate({ to: '/' });
      }}
    >
      <Compass aria-hidden="true" />
      <span>Getting started</span>
      <span className="sidebar-setup-progress">
        {ready} of {steps.length} ready
      </span>
      <span className="sidebar-footer-beads" aria-hidden="true">
        {steps.map(([step, done]) => (
          <span
            key={step}
            className="clay-bead"
            data-size="sm"
            data-tone={done ? 'moss' : undefined}
            data-empty={done ? undefined : ''}
          />
        ))}
      </span>
    </SidebarMenuButton>
  );
};
