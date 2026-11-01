import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import { SettingsSection } from './SettingsSection.tsx';

export const DataSettings = ({ directory }: { directory: string }) => (
  <SettingsSection
    id="data-heading"
    title="Saved on this device"
    description="Your board, Profile notes, chats and packets live in this folder. Back up or move your workspace by keeping a copy of it."
  >
    <SourceBlock label="Workspace data folder" value={directory} className="settings-path" />
  </SettingsSection>
);
