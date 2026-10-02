import type { Action } from '@/WorkspaceStore/index.ts';
import type { ComputerApproval } from '@pitchcrew/core';

export interface ComputerApprovalsProps {
  approvals: ComputerApproval[];
  action: Action;
  working: boolean;
}
