import { usePaletteReady } from '../hooks/usePaletteReady.ts';
import { CommandPalette } from '../constants.ts';
import { PanelLoadBoundary } from '@/LoadRecovery/index.tsx';
import type { WorkspacePaletteProps } from '@/App/types.ts';

export const WorkspacePalette = ({
  paletteOpen,
  setPaletteOpen,
  data,
  go,
  openCard,
  setRoleId,
  openChat,
  setAdd,
  checkRuntimes,
  setTheme,
  copyDirectory,
}: WorkspacePaletteProps) => {
  const ready = usePaletteReady(paletteOpen, setPaletteOpen);
  if (!ready) return null;
  return (
    <PanelLoadBoundary subject="Search" onClose={() => setPaletteOpen(false)}>
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        cards={data.cards}
        roles={data.roles}
        onNavigate={go}
        onOpenCard={openCard}
        onConfigureRole={setRoleId}
        onChatRole={openChat}
        onAddJob={() => setAdd(true)}
        onCheckRuntimes={checkRuntimes}
        onTheme={setTheme}
        onCopyDirectory={copyDirectory}
      />
    </PanelLoadBoundary>
  );
};
