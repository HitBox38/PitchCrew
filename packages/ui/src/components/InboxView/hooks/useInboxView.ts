import type { InboxTab, InboxViewProps } from '../types.ts';
import { approvalRequests, selectedApprovalRequest } from '../helpers.ts';
import { useState } from 'react';

export function useInboxView({ data, action, working, onOpen }: InboxViewProps) {
  const [tab, changeTab] = useState<InboxTab>('pending');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const requests = approvalRequests(data, tab);
  const selectedRequest = selectedApprovalRequest(requests, selectedKey);
  const setTab = (next: InboxTab) => {
    changeTab(next);
    setSelectedKey(null);
    setReviewOpen(false);
  };
  const selectRequest = (key: string) => {
    setSelectedKey(key);
    setReviewOpen(true);
  };
  const showRequests = () => setReviewOpen(false);
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
    selectedRequest,
    reviewOpen,
    selectRequest,
    showRequests,
    act,
  };
}
