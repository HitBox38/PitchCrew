import { useStore } from 'zustand';
import { cachedAttention } from '@/lib/attention.ts';
import { useNotificationStore } from '@/Notifications/store.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { deskEntries } from '../helpers.ts';
import { deskRecords } from '../records.ts';

/**
 * This session's record lines and the desk calls in flight (whose rows stay where they stood
 * while a poll snapshot lacks them), for rendering.
 */
export const useDeskRecords = () => ({
  records: useStore(deskRecords.store, (state) => state.records),
  flights: useStore(deskRecords.store, (state) => state.flights),
});

/** The desk's rows as the stores hold them right now, for callbacks outside rendering. */
export const currentEntries = () => {
  const data = useWorkspaceStore.getState().data;
  if (!data) return [];
  const { records, flights } = deskRecords.store.getState();
  const items = cachedAttention(data, useNotificationStore.getState().remoteRequests);
  return deskEntries(items, records, flights);
};
