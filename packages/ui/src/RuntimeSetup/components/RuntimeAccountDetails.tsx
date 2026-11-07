import type { RuntimeId } from '@pitchcrew/core';
import { AccordionSection } from '@pitchcrew/design-system/accordion';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { RuntimeAuthentication } from '@/RuntimeMaintenance/components/RuntimeAuthentication.tsx';

export const RuntimeAccountDetails = ({ runtime }: { runtime: RuntimeId }) => {
  const results = useWorkspaceStore((store) => store.data?.runtimeMaintenance?.authentication);
  const entries = results?.filter((entry) => entry.runtime === runtime) ?? [];
  return (
    <AccordionSection heading="Account details and CLI instructions">
      <div className="settings-stack pt-3">
        {entries.map((entry) => (
          <RuntimeAuthentication key={entry.model} model={entry.model} result={entry.result} />
        ))}
        {!entries.length ? (
          <p className="quiet">
            Recheck sign-in to inspect the current account. A configured credential is not proof of
            model access.
          </p>
        ) : null}
      </div>
    </AccordionSection>
  );
};
