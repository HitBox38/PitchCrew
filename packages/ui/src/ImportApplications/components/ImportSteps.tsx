const steps = ['Choose file', 'Review', 'Result'];

/** Three labelled beads: finished steps are filled, the current one is larger. */
export const ImportSteps = ({ step }: { step: number }) => (
  <ol className="import-steps" aria-label="Import steps">
    {steps.map((label, index) => (
      <li key={label} aria-current={index === step ? 'step' : undefined}>
        <span
          className="clay-bead"
          data-size={index === step ? undefined : 'sm'}
          data-tone={index <= step ? 'done' : undefined}
          data-empty={index > step ? '' : undefined}
          aria-hidden="true"
        />
        <span>{label}</span>
        <span className="sr-only">
          {index < step ? ', done' : index === step ? ', current' : ', not started'}
        </span>
      </li>
    ))}
  </ol>
);
