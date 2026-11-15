import type { Card } from '@pitchcrew/core';
import { DetectorConsent } from './components/DetectorConsent.tsx';
import { DetectorRow } from './components/DetectorRow.tsx';
import { useDetectorChecks } from './hooks/useDetectorChecks.ts';

/**
 * Optional external AI-text detector results for the cover letter and form answers. Rows appear
 * only once the user has saved a detector key; checks start only here or in job details.
 */
export const DetectorChecks = ({ card, canAct = true }: { card: Card; canAct?: boolean }) => {
  const model = useDetectorChecks(card);
  const hasResults = model.rows.some((row) => row.advisories.length);
  if (!model.rows.length || (!model.providers.length && !hasResults)) return null;
  return (
    <section className="detector-checks" aria-label="AI-text detector checks">
      <h3 className="packet-section-heading">
        AI-text detectors <span>Advisory only, with your own account</span>
      </h3>
      <ul>
        {model.rows.map((row) => (
          <DetectorRow
            key={row.document}
            row={row}
            providers={model.providers}
            canAct={canAct && model.ready && !model.working}
            onCheck={(provider) => model.setConsent({ row, provider })}
            onRevise={(advisory) => void model.askWriter(advisory, row)}
          />
        ))}
      </ul>
      <DetectorConsent
        consent={model.consent}
        close={() => model.setConsent(null)}
        confirm={(consent) => void model.check(consent)}
        working={model.working}
      />
    </section>
  );
};
