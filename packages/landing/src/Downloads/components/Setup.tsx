import { Bead } from '../../components/clay/Bead';
import { documentationUrl } from '../../lib/links';

/** Setup as the app's labelled bead stepper: three steps, one of them already yours. */
export const Setup = () => {
  return (
    <div className="setup">
      <h2 id="download-title" className="headline">
        A little setup, then a crew behind you.
      </h2>
      <ol className="setup-steps">
        {steps.map((step, index) => (
          <li key={step.title} className="setup-step">
            <span className="setup-bead">
              <Bead tone={index === 0 ? 'ochre' : undefined} size="lg" />
              {index < steps.length - 1 ? <span className="setup-rule" aria-hidden="true" /> : null}
            </span>
            <div>
              <h3 className="setup-title">{step.title}</h3>
              <p className="copy">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="meta setup-cost">
        Pitchcrew is free and open source. Your AI account and any usage costs are separate.{' '}
        <a className="text-link" href={documentationUrl}>
          Read the setup guide
        </a>
      </p>
    </div>
  );
};

const steps = [
  {
    title: 'Download Pitchcrew.',
    text: 'The installer includes the local server and browser the app needs.',
  },
  {
    title: 'Connect your AI tool.',
    text: 'Install a supported tool such as Codex or Claude Code, sign in following its own instructions, then pick it for your crew.',
  },
  {
    title: 'Add your background and a job.',
    text: 'Write factual notes in Profile and add a job to Board. A setup checklist walks you through it.',
  },
];
