import { Link } from '@tanstack/react-router';
import { FileCheck2, LoaderCircle } from 'lucide-react';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { buttonVariants } from '@pitchcrew/design-system/button';

/** Renders nothing while idle, so the sidebar's notices collapse with plain CSS. */
export const SourceActivity = ({ onOpen }: { onOpen: () => void }) => {
  const progress = useWorkspaceStore((state) => state.profileSources.progress);
  const ready = useWorkspaceStore((state) => !!state.profileSources.preview);
  const update = useWorkspaceStore((state) => state.updateProfileSources);
  if (!progress && !ready) return null;
  const label = progress?.label ?? 'Profile documents ready to review.';
  return (
    <section
      aria-label="Profile source activity"
      className="sidebar-source-activity min-w-0"
      onClickCapture={onOpen}
    >
      <Link
        data-slot="button"
        className={buttonVariants({
          variant: 'ghost',
          size: 'sm',
          className: 'h-[30px] max-w-full min-w-0 rounded-lg px-2 font-normal',
        })}
        to="/profile"
        onClick={() => update({ open: true })}
        aria-label="Open profile sources"
        title={label}
      >
        <output className="flex min-w-0 items-center gap-2">
          {progress ? (
            <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <FileCheck2 aria-hidden="true" />
          )}
          <span className="truncate max-phone:sr-only">{label}</span>
        </output>
      </Link>
    </section>
  );
};
