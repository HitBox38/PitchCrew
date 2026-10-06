import type { Snapshot } from '@pitchcrew/core';
import { Link } from '@tanstack/react-router';
import { Compass } from 'lucide-react';
import { WorkspaceNotice } from '@/WorkspaceNotice/index.tsx';
import { setupProgress } from '../helpers.ts';

export function SetupProgress({ data }: { data: Snapshot }) {
  const count = Object.values(setupProgress(data)).filter(Boolean).length;
  return (
    <WorkspaceNotice
      title="Getting started"
      icon={<Compass size={20} className="text-primary" />}
      className="max-w-210"
      actions={
        <Link to="/" className="button small">
          Back to setup
        </Link>
      }
    >
      <output>{count} of 3 ready</output>
    </WorkspaceNotice>
  );
}
