import { UpdateSettings } from '@/AppUpdates/components/UpdateSettings.tsx';
import { SkillUpdateSettings } from '@/AgentUpdates/components/SkillUpdateSettings.tsx';
import { RuntimeUpdatesLink } from './RuntimeUpdatesLink.tsx';
import { UpdateReviews } from './UpdateReviews.tsx';

export const UpdatesSettings = () => (
  <>
    <UpdateSettings />
    <SkillUpdateSettings />
    <UpdateReviews />
    <RuntimeUpdatesLink />
  </>
);
