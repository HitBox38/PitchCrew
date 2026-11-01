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
      The crew works when you ask. Nothing is exported, and no browser button is pressed, until you
      approve that exact packet or action.
    </p>
    <p className="onboarding-local">
      Your profile, board and drafts stay on this device. Agents run on the AI runtimes you choose.
    </p>
  </div>
);
