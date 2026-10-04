import { useAppReducedMotion } from '@/AppMotion/hooks/useAppReducedMotion.ts';
import { copyDataDirectory } from '@/lib/data-directory.ts';
import { useShortcuts } from '@/shortcuts.ts';
import { useTheme } from '@/theme.ts';
import { useWorkspaceNavigation } from '@/workspace-navigation.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useMatches, useNavigate, useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

export function useApp() {
  const reduced = useAppReducedMotion();
  const {
    data,
    error,
    toast,
    working,
    add,
    selectedId,
    roleId,
    recentIds,
    reload,
    startSync,
    action,
    act,
    setToast,
    setAdd,
    setSelectedId,
    setRoleId,
    openCard,
    closePanels,
  } = useWorkspaceStore(
    useShallow((state) => ({
      data: state.data,
      error: state.error,
      toast: state.toast,
      working: state.working,
      add: state.add,
      selectedId: state.selectedId,
      roleId: state.roleId,
      recentIds: state.recentIds,
      reload: state.reload,
      startSync: state.startSync,
      action: state.action,
      act: state.act,
      setToast: state.setToast,
      setAdd: state.setAdd,
      setSelectedId: state.setSelectedId,
      setRoleId: state.setRoleId,
      openCard: state.openCard,
      closePanels: state.closePanels,
    })),
  );
  const { go, openChat } = useWorkspaceNavigation();
  useEffect(() => startSync(), [startSync]);
  const navigate = useNavigate();
  const router = useRouter();
  const view = useMatches({
    select: (matches) => matches.findLast((match) => match.staticData.view)?.staticData.view,
  });
  const [sidebarOpen] = useState(
    () => !document.cookie.split('; ').includes('sidebar_state=false'),
  );
  const [theme, setTheme] = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteMounted, setPaletteMounted] = useState(false);
  if (paletteOpen && !paletteMounted) setPaletteMounted(true);
  useShortcuts({ search: () => setPaletteOpen(true), newJob: () => setAdd(true) });
  useEffect(
    () =>
      router.subscribe('onBeforeNavigate', ({ fromLocation, toLocation }) => {
        if (fromLocation?.href === toLocation.href) return;
        closePanels();
        setPaletteOpen(false);
      }),
    [router, closePanels],
  );
  const pending =
    (data?.approvals.filter((a) => a.status === 'pending').length ?? 0) +
    (data?.computerApprovals.filter((a) => a.status === 'pending').length ?? 0);
  const selected = data?.cards.find((c) => c.id === selectedId);
  const selectedRole = data?.roles.find((r) => r.id === roleId);
  const jumpToStage = (id: string) => {
    go('board');
    const { setShowClosed, setQuery, setFlashStage } = useWorkspaceStore.getState();
    setShowClosed(false);
    setQuery('');
    setFlashStage(id);
  };
  const copyDirectory = () => {
    if (!data) return;
    copyDataDirectory(data.dataDirectory);
  };
  const checkRuntimes = () =>
    act('/runtimes/detect', 'POST', undefined, 'Checked installed runtimes');
  return {
    reduced,
    data,
    error,
    toast,
    working,
    add,
    selectedId,
    roleId,
    recentIds,
    reload,
    startSync,
    action,
    act,
    setToast,
    setAdd,
    setSelectedId,
    setRoleId,
    openCard,
    closePanels,
    go,
    openChat,
    navigate,
    router,
    view,
    sidebarOpen,
    theme,
    setTheme,
    paletteOpen,
    setPaletteOpen,
    paletteMounted,
    setPaletteMounted,
    pending,
    selected,
    selectedRole,
    jumpToStage,
    copyDirectory,
    checkRuntimes,
  };
}
