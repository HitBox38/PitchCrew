const steps = [
  { label: 'Packet drafted', tone: 'done' },
  { label: 'Reviewer checks it', tone: 'done' },
  { label: 'You approve', tone: 'ochre' },
  { label: 'Exported to a folder', tone: undefined },
] as const;

/** Screen two: the actual packet → review → your decision sequence, then the local-data line. */
export const ApprovalIntroduction = () => (
  <div className="onboarding-approval">
    <ol className="onboarding-sequence">
      {steps.map((step) => (
        <li key={step.label}>
          <span
            className="clay-bead"
            data-tone={step.tone}
            data-empty={step.tone ? undefined : ''}
            aria-hidden="true"
          />
          <span>{step.label}</span>
        </li>
      ))}
    </ol>
    <p>
      You approve the exact files before export. Browser actions follow the permissions you choose,
      and an agent asks before the final application submission.
    </p>
    <p className="onboarding-local">
      Your profile, board and drafts are saved on this device. AI runs share the context they need
      with your chosen runtime and AI provider.
    </p>
  </div>
);
