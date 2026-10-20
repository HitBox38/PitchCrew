import { Link } from '@tanstack/react-router';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { buttonVariants } from '@/components/ui/button/constants.ts';
import { SourceProgress } from './SourceProgress.tsx';

export const SourceActivity = () => {
  const progress = useWorkspaceStore((state) => state.profileSources.progress);
  const ready = useWorkspaceStore((state) => !!state.profileSources.preview);
  const update = useWorkspaceStore((state) => state.updateProfileSources);
  if (!progress && !ready) return null;
  return (
    <section
      aria-label="Profile source activity"
      className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2"
    >
      {progress ? (
        <SourceProgress label={progress.label} />
      ) : (
        <output className="text-sm text-muted-foreground">
          Profile documents ready to review.
        </output>
      )}
      <Link
        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        to="/profile"
        onClick={() => update({ open: true })}
      >
        Open profile sources
      </Link>
    </section>
  );
};
