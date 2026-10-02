import { CommandPalette } from '@/App/constants.ts';
import type { WorkspacePaletteProps } from '@/App/types.ts';
import { Suspense } from 'react';

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
  return (
    <Suspense fallback={null}>
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
    </Suspense>
  );
}
