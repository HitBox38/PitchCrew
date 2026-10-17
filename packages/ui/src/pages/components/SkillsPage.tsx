import { skillsRoute } from '@/pages/constants.ts';
import { SkillsView } from '@/SkillsView/index.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useShallow } from 'zustand/react/shallow';

export function SkillsPage() {
  const { data, action, working } = useWorkspaceStore(
    useShallow((state) => ({
      data: state.data,
      action: state.action,
      working: state.working,
    })),
  );
  const { filter = 'all', skill, review, updates } = skillsRoute.useSearch();
  const navigate = skillsRoute.useNavigate();
  if (!data) return null;
  return (
    <SkillsView
      data={data}
      action={action}
      working={working}
      filter={filter}
      selectedId={skill}
      onSelect={(id) =>
        void navigate({
          search: (previous) => ({ ...previous, skill: id ?? undefined, review: undefined }),
        })
      }
      updatesOnly={Boolean(updates)}
      onUpdatesOnly={() =>
        void navigate({
          search: (previous) => ({
            ...previous,
            updates: updates ? undefined : true,
            review: undefined,
          }),
        })
      }
      reviewId={review ? skill : undefined}
      onReviewClose={() =>
        void navigate({ search: (previous) => ({ ...previous, review: undefined }), replace: true })
      }
      onFilter={(next) => {
        void navigate({
          search: (previous) => ({
            ...previous,
            filter: next === 'all' ? undefined : next,
            skill: undefined,
            review: undefined,
          }),
        });
      }}
    />
  );
}
