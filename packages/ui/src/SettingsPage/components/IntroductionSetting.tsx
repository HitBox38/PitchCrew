import { Button } from '@/components/ui/button/components/Button.tsx';
import { useOnboarding } from '@/Onboarding/hooks/useOnboarding.ts';
import { SettingsSection } from './SettingsSection.tsx';

export const IntroductionSetting = () => {
  const { data, working, save } = useOnboarding();
  if (!data?.onboarding) return null;
  return (
    <SettingsSection id="introduction-heading" title="Getting started">
      <div className="settings-row">
        <span>
          <strong>Introduction</strong>
          <span className="quiet block">The crew, approvals and the Board setup checklist.</span>
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
    </SettingsSection>
  );
};
