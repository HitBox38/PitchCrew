import { useSidebar } from '@/components/ui/sidebar/hooks/useSidebar.ts';
import type { View } from '@/navigation.ts';
import { useShellShortcuts } from '../hooks/useShellShortcuts.ts';

/** Registers the shell's keyboard shortcuts inside the sidebar provider. */
export const ShellShortcuts = ({ go }: { go: (view: View) => void }) => {
  const { toggleSidebar } = useSidebar();
  useShellShortcuts(go, toggleSidebar);
  return null;
};
