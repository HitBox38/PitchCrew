import { useOnboarding } from './hooks/useOnboarding.ts';
import { WelcomeDialog } from './components/WelcomeDialog.tsx';
import { SetupChecklist } from './components/SetupChecklist.tsx';

/** The two-screen introduction, shown over any page until it is finished or deferred. */
export const Onboarding = () => {
  const { data, working, error, save } = useOnboarding();
  if (data?.onboarding?.status !== 'welcome') return null;
  return <WelcomeDialog step={data.onboarding.step} working={working} error={error} save={save} />;
};

/** The setup checklist, placed first on Home while onboarding is in setup. */
export const HomeSetup = () => {
  const { data, working, error, save } = useOnboarding();
  if (!data || data.onboarding?.status !== 'setup') return null;
  return <SetupChecklist data={data} working={working} error={error} save={save} />;
};
