import type { CommandPaletteProps } from '@/CommandPalette/types.ts';
import { useSidebar } from '@/components/ui/sidebar/hooks/useSidebar.ts';

export function useCommandPalette({
  open,
  onOpenChange,
  cards,
  roles,
  onNavigate,
  onOpenCard,
  onConfigureRole,
  onChatRole,
  onAddJob,
  onCheckRuntimes,
  onTheme,
  onCopyDirectory,
}: CommandPaletteProps) {
  const { toggleSidebar } = useSidebar();
  const run = (fn: () => void) => () => {
    onOpenChange(false);
    fn();
  };
  return {
    open,
    onOpenChange,
    cards,
    roles,
    onNavigate,
    onOpenCard,
    onConfigureRole,
    onChatRole,
    onAddJob,
    onCheckRuntimes,
    onTheme,
    onCopyDirectory,
    toggleSidebar,
    run,
  };
}
