import { useOnboarding } from './hooks/useOnboarding.ts';
import { WelcomeDialog } from './components/WelcomeDialog.tsx';
import { SetupChecklist } from './components/SetupChecklist.tsx';
import { SetupProgress } from './components/SetupProgress.tsx';
import { useMatches } from '@tanstack/react-router';

export function Onboarding() {
  const { data, working, error, save } = useOnboarding();
  const onBoard = useMatches({
    select: (matches) => matches.some((match) => match.staticData.view === 'board'),
  });
  if (!data?.onboarding) return null;
  if (data.onboarding.status === 'welcome')
    return (
      <WelcomeDialog step={data.onboarding.step} working={working} error={error} save={save} />
    );
  if (data.onboarding.status === 'setup')
    return onBoard ? (
      <SetupChecklist data={data} working={working} error={error} save={save} />
    ) : (
      <SetupProgress data={data} />
    );
  return null;
}
