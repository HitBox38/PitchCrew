import type { useCommandPalette } from '@/CommandPalette/hooks/useCommandPalette.ts';
import type { View } from '@/navigation.ts';
import type { ThemeChoice } from '@/theme.ts';
import type { Card, Role, RoleId } from '@pitchcrew/core';

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: Card[];
  roles: Role[];
  onNavigate: (view: View) => void;
  onOpenCard: (id: string) => void;
  onConfigureRole: (id: RoleId) => void;
  onChatRole: (id: RoleId) => void;
  onAddJob: () => void;
  onCheckRuntimes: () => void;
  onTheme: (theme: ThemeChoice) => void;
  onCopyDirectory: () => void;
}
export type CommandPaletteModel = ReturnType<typeof useCommandPalette>;

export type CrewCommandsProps = Pick<
  CommandPaletteModel,
  'roles' | 'run' | 'onChatRole' | 'onConfigureRole'
>;

export type JobCommandsProps = Pick<
  CommandPaletteModel,
  'cards' | 'run' | 'onOpenCard' | 'recentIds'
>;

export type NavigationCommandsProps = Pick<CommandPaletteModel, 'run' | 'onNavigate'>;

export type ConversationCommandsProps = Pick<
  CommandPaletteModel,
  'cards' | 'roles' | 'conversations' | 'run' | 'onOpenConversation'
>;

export type WorkspaceCommandsProps = Pick<
  CommandPaletteModel,
  'run' | 'onAddJob' | 'onNewConversation' | 'onNewNote'
>;

export type SettingsCommandsProps = Pick<
  CommandPaletteModel,
  | 'run'
  | 'onCheckUpdates'
  | 'onShowIntroduction'
  | 'toggleSidebar'
  | 'onCheckRuntimes'
  | 'onCopyDirectory'
  | 'onTheme'
>;

export type NoteCommandsProps = Pick<CommandPaletteModel, 'notes' | 'run' | 'onOpenNote'>;
