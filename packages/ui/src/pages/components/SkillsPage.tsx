import { skillsRoute, SkillsView } from '@/pages/constants.ts';
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
  const { filter = 'all' } = skillsRoute.useSearch();
  const navigate = skillsRoute.useNavigate();
  if (!data) return null;
  return (
    <SkillsView
      data={data}
      action={action}
      working={working}
      filter={filter}
      onFilter={(next) => {
        void navigate({ search: next === 'all' ? {} : { filter: next } });
      }}
    />
  );
}
