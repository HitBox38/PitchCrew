import { useRef } from 'react';
import { useStableCallbacks } from '@/lib/use-stable-callbacks.ts';
import { HomeSetup } from '@/Onboarding/index.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { HomeFact } from './components/HomeFact.tsx';
import { HomeRail } from './components/HomeRail/index.tsx';
import { NeedsYou } from './components/NeedsYou.tsx';
import { SinceButton } from './components/SinceSection/components/SinceButton.tsx';
import { useSinceJump } from './components/SinceSection/hooks/useSinceJump.ts';
import { SinceSection } from './components/SinceSection/index.tsx';
import { WorkStrip } from './components/WorkStrip.tsx';
import { useDesk } from './hooks/useDesk.ts';
import { useHome, type HomeModel } from './hooks/useHome.ts';

/**
 * Home with its snapshot: the setup checklist while setup is open, then everything that waits on
 * the user, ranked, with the top item open and decided in place, beside the crew's live work.
 * DOM order is reading order: setup band, work strip, Needs you, Since, rail.
 */
const HomeView = ({ data, items, now, rail, since }: HomeModel) => {
  const tray = useRef<HTMLDivElement>(null);
  const desk = useDesk(items, tray);
  const jump = useSinceJump();
  const openCard = useWorkspaceStore((state) => state.openCard);
  // Rail and since rows open a Needs you row, the job's details or a conversation.
  const links = useStableCallbacks({ show: desk.show, openCard: (id: string) => openCard(id) });
  return (
    <div className="home" data-setup={data.onboarding?.status === 'setup' ? '' : undefined}>
      <HomeFact items={items} data={data} />
      <HomeSetup />
      <WorkStrip rail={rail} now={now} />
      <NeedsYou
        desk={desk}
        tray={tray}
        items={items}
        data={data}
        now={now}
        since={<SinceButton summary={since.summary} range={since.range} onJump={jump.jump} />}
      />
      <SinceSection
        {...since}
        now={now}
        links={links}
        area={jump.area}
        open={jump.open}
        onOpenChange={jump.setOpen}
      />
      <HomeRail rail={rail} now={now} links={links} />
    </div>
  );
};

/**
 * Home: the title fact, the list's count and the sidebar's Home badge count the same attention
 * list. Nothing renders until the first snapshot; the shell shows its own loading.
 */
export const HomePage = () => {
  const home = useHome();
  return home ? <HomeView {...home} /> : null;
};
