import type { Snapshot } from '@pitchcrew/core';
import { Link } from '@tanstack/react-router';
import { Compass } from 'lucide-react';
import { setupProgress } from '../helpers.ts';

export function SetupProgress({ data }: { data: Snapshot }) {
  const count = Object.values(setupProgress(data)).filter(Boolean).length;
  return (
    <aside className="onboarding-checklist mb-5 flex max-w-210 flex-wrap items-center gap-3">
      <Compass size={18} className="text-primary" aria-hidden="true" />
      <p className="flex-1 text-sm">
        Getting started <output className="ml-2 text-muted-foreground">{count} of 3 ready</output>
      </p>
      <Link to="/" className="text-sm text-primary underline underline-offset-4">
        Back to setup
      </Link>
    </aside>
  );
}
