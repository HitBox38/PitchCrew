import type { Snapshot } from '@pitchcrew/core';
import { ConversationNavigationView } from './components/ConversationNavigationView.tsx';
import { useConversationActions } from './hooks/useConversationActions.ts';
import { useConversationNavigation } from './hooks/useConversationNavigation.ts';

export const ConversationNavigation = ({ data }: { data: Snapshot }) => {
  const actions = useConversationActions();
  const navigation = useConversationNavigation(data);
  return (
    <ConversationNavigationView navigation={navigation} actions={actions} rows={navigation.rows} />
  );
};
