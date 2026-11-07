import { Button } from '@pitchcrew/design-system/button';
import { useOnboarding } from '@/Onboarding/hooks/useOnboarding.ts';

export const IntroductionSetting = () => {
  const { data, working, save } = useOnboarding();
  if (!data?.onboarding) return null;
  return (
    <div className="settings-row settings-introduction">
      <span>
        <strong>Workspace introduction</strong>
        <span className="quiet block">Reopen the crew and approvals guide for this workspace.</span>
      </span>
      <Button
        id="show-introduction"
        variant="ghost"
        size="sm"
        disabled={working}
        onClick={() => void save('welcome', 0)}
      >
        Show introduction
      </Button>
    </div>
  );
};
