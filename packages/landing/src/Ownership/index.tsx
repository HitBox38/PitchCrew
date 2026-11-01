import { licenseUrl, repository } from '../lib/links';

export const Ownership = () => {
  return (
    <section id="local" className="section ownership" aria-labelledby="local-title">
      <div className="page-width">
        <div className="own">
          <div className="own-grid">
            <h2 id="local-title" className="headline">
              Your computer. Your AI. Your call.
            </h2>
            <div className="own-facts">
              {facts.map((fact) => (
                <div key={fact.title} className="own-fact">
                  <h3 className="feature-title">{fact.title}</h3>
                  <p className="copy">{fact.text}</p>
                </div>
              ))}
              <div className="own-fact">
                <h3 className="feature-title">Open source</h3>
                <p className="copy">
                  Read every line on{' '}
                  <a className="text-link" href={repository}>
                    GitHub
                  </a>
                  . Pitchcrew is free and released under the{' '}
                  <a className="text-link" href={licenseUrl}>
                    MIT License
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
          <div className="runtimes">
            <p className="meta">
              <strong>Works with</strong> the AI command-line tool you sign in to yourself. Each
              agent can use a different one.
            </p>
            <ul className="runtime-list" aria-label="Supported AI tools">
              {runtimes.map((runtime) => (
                <li key={runtime} className="runtime">
                  {runtime}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

const facts = [
  {
    title: 'Stored on your computer',
    text: 'Your board, profile notes, chats and packets live in a local folder. When an agent runs, the context it needs goes to the AI provider you chose, so runs are not offline.',
  },
  {
    title: 'Runs on the AI you already have',
    text: 'Pitchcrew does not sell an AI plan. Usage follows your provider’s plan, and Pitchcrew never reads or stores your provider tokens.',
  },
];

const runtimes = [
  'Codex',
  'Claude Code',
  'Gemini CLI',
  'OpenCode',
  'GitHub Copilot CLI',
  'Cursor Agent',
  'Goose',
  'Kiro CLI',
  'Grok Build',
  'Pi',
  'oh-my-pi',
  'Hermes Agent',
];
