import type { InboxTab, InboxViewProps } from '../types.ts';
import { approvalRequests, requestIdentity } from '../helpers.ts';
import { useState } from 'react';
import { attachmentFiles } from '@/FileViewer/attachments.ts';
import {
  readInboxPreference,
  saveInboxPreference,
  readInboxReadIds,
  saveInboxReadIds,
} from './preferences.ts';

export const useInboxView = ({ data, action, working, onOpen }: InboxViewProps) => {
  const [tab, changeTab] = useState<InboxTab>(() => readInboxPreference('tab', 'pending'));
  const [selectedKey, setSelectedKey] = useState<string | null>(() =>
    readInboxPreference('selected', null),
  );
  const [search, changeSearch] = useState(() => readInboxPreference('search', ''));
  const [filter, changeFilter] = useState<'all' | 'packet' | 'browser'>(() =>
    readInboxPreference('filter', 'all'),
  );
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [readIds, setReadIds] = useState(readInboxReadIds);
  const allRequests = [...approvalRequests(data, 'pending'), ...approvalRequests(data, 'history')];
  const selectedRequest = allRequests.find((request) => request.key === selectedKey);
  const markRead = (key: string, read: boolean) =>
    setReadIds((ids) => {
      const next = read ? [...new Set([...ids, key])] : ids.filter((id) => id !== key);
      saveInboxReadIds(next);
      return next;
    });
  const selectRequest = (key: string) => {
    setSelectedKey(key);
    saveInboxPreference('selected', key);
    markRead(key, true);
  };
  const showRequests = () => {
    setSelectedKey(null);
    saveInboxPreference('selected', null);
  };
  const setTab = (next: InboxTab) => {
    changeTab(next);
    saveInboxPreference('tab', next);
    showRequests();
  };
  const setSearch = (next: string) => {
    changeSearch(next);
    saveInboxPreference('search', next);
  };
  const setFilter = (next: typeof filter) => {
    changeFilter(next);
    saveInboxPreference('filter', next);
  };
  const requests = approvalRequests(data, tab).filter((request) => {
    if (filter !== 'all' && request.kind !== filter) return false;
    if (unreadOnly && readIds.includes(request.key)) return false;
    const identity = requestIdentity(request, data);
    return [
      identity.sender,
      identity.subject,
      identity.context,
      ...attachmentFiles(request).map((file) => file.name),
    ]
      .join(' ')
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase());
  });
  const act = (path: string, body?: unknown, success?: string) => {
    void action(path, 'POST', body, success).catch(() => {});
  };
  return {
    data,
    action,
    working,
    onOpen,
    tab,
    setTab,
    requests,
    allRequests,
    selectedRequest,
    reviewOpen: !!selectedRequest,
    selectRequest,
    showRequests,
    act,
    search,
    setSearch,
    filter,
    setFilter,
    unreadOnly,
    setUnreadOnly,
    readIds,
    markRead,
  };
};
