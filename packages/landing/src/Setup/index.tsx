import { Download, FileUser, Wrench } from 'lucide-react';
import { documentationUrl } from '../lib/links';

const steps = [
  {
    icon: Download,
    title: 'Download Pitchcrew.',
    text: 'It includes the local server and browser the app needs.',
  },
  {
    icon: Wrench,
    title: 'Connect your AI tool.',
    text: 'Install a supported tool, such as Codex or Claude Code, sign in following its own instructions, then pick it for your crew.',
  },
  {
    icon: FileUser,
    title: 'Add your background and a job.',
    text: 'Write factual notes in Profile and add a job to Board. A setup checklist walks you through it.',
  },
];

/** The download section's introduction: what setup takes, in three steps. */
export function Setup() {
  return (
    <div>
      <h2 id="download-title" className="section-title">
        A little setup, then a crew behind you.
      </h2>
      <ol className="setup-steps">
        {steps.map(({ icon: Icon, title, text }) => (
          <li key={title}>
            <Icon size={20} aria-hidden="true" />
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="setup-cost">
        Pitchcrew is free and open source. Your AI account and any usage costs are separate.{' '}
        <a className="text-link" href={documentationUrl}>
          Read the setup guide
        </a>
      </p>
    </div>
  );
}
