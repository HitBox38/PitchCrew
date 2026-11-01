import type { HistoryFilter, InboxViewProps } from '../types.ts';
import { approvalRequests, historyGroups, requestIdentity } from '../helpers.ts';
import { useState } from 'react';
import { attachmentFiles } from '@/FileViewer/attachments.ts';
import { readInboxPreference, saveInboxPreference } from './preferences.ts';

/** Past packet and browser decisions, searchable, with the open one kept in the URL. */
export const useInboxView = (props: InboxViewProps) => {
  const { data, action } = props;
  const [search, changeSearch] = useState(() => readInboxPreference('search', ''));
  const [filter, changeFilter] = useState<HistoryFilter>(() =>
    readInboxPreference('filter', 'all'),
  );
  // Day groups are relative to when history opened; a reopen refreshes them.
  const [now] = useState(() => new Date());
  const allRequests = approvalRequests(data, 'history');
  const selectedRequest = allRequests.find((request) => request.key === props.selected);
  const setSearch = (next: string) => {
    changeSearch(next);
    saveInboxPreference('search', next);
  };
  const setFilter = (next: HistoryFilter) => {
    changeFilter(next);
    saveInboxPreference('filter', next);
  };
  const query = search.trim().toLocaleLowerCase();
  const requests = allRequests.filter((request) => {
    if (filter !== 'all' && request.kind !== filter) return false;
    const identity = requestIdentity(request, data);
    return [
      identity.sender,
      identity.subject,
      identity.context,
      ...attachmentFiles(request).map((file) => file.name),
    ]
      .join(' ')
      .toLocaleLowerCase()
      .includes(query);
  });
  const act = (path: string, body?: unknown, success?: string) => {
    void action(path, 'POST', body, success).catch(() => {});
  };
  return {
    ...props,
    requests,
    groups: historyGroups(requests, now),
    total: allRequests.length,
    selectedRequest,
    act,
    search,
    setSearch,
    filter,
    setFilter,
  };
};
