import { usePaletteReady } from '../hooks/usePaletteReady.ts';
import { CommandPalette } from '../constants.ts';
import type { WorkspacePaletteProps } from '@/App/types.ts';

export function WorkspacePalette({
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
}: WorkspacePaletteProps) {
  const ready = usePaletteReady(paletteOpen, setPaletteOpen);
  if (!ready) return null;
  return (
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
  );
}
