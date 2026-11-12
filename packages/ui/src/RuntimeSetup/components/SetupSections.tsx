import { TabsIndicator, TabsList, TabsTrigger } from '@pitchcrew/design-system/tabs';
import type { RuntimeAuthState, RuntimeInfo } from '@pitchcrew/core';
import { runtimeSetupSections } from '../sections.ts';
export const SetupSections = ({
  runtime,
  auth,
  signedIn,
  installing,
}: {
  runtime: RuntimeInfo;
  auth?: RuntimeAuthState;
  signedIn: boolean;
  installing: boolean;
}) => {
  const sections = runtimeSetupSections(runtime, auth, signedIn, installing);
  return (
    <TabsList className="settings-segment runtime-setup-sections" aria-label="Runtime setup steps">
      {sections.map((section) => (
        <TabsTrigger
          key={section.id}
          className="settings-segment-option"
          value={section.id}
          aria-label={section.label}
        >
          <span>{section.label}</span>
          <span className="runtime-step-status">
            <span
              className="clay-bead"
              data-size="sm"
              data-tone={section.tone || undefined}
              data-empty={!section.tone || undefined}
              aria-hidden="true"
            />
            {section.status}
          </span>
        </TabsTrigger>
      ))}
      <TabsIndicator />
    </TabsList>
  );
};
