import { useLayoutEffect, useMemo, useState } from 'react';
import {
  clearVisibleBrowserApprovals,
  setVisibleBrowserApprovals,
} from '../approval-visibility.ts';
import type { AgentBrowserProps } from '../types.ts';

export const useBrowserApprovalVisibility = ({ browserPanel, data }: AgentBrowserProps) => {
  const [owner] = useState(() => Symbol('visible-browser-approvals'));
  const roleId = browserPanel.role?.id;
  const runId = browserPanel.session?.runId;
  const shown = browserPanel.open && browserPanel.available;
  const ids = useMemo(
    () =>
      shown
        ? data.computerApprovals
            .filter(
              (approval) =>
                approval.roleId === roleId &&
                approval.runId === runId &&
                approval.status === 'pending',
            )
            .map((approval) => approval.id)
        : [],
    [data.computerApprovals, roleId, runId, shown],
  );
  useLayoutEffect(() => setVisibleBrowserApprovals(owner, ids), [owner, ids]);
  useLayoutEffect(() => () => clearVisibleBrowserApprovals(owner), [owner]);
};
