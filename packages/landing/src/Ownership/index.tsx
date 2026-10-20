import { licenseUrl, repository } from '../lib/links';

export const Ownership = () => {
  return (
    <section id="local" className="own-section" aria-labelledby="local-title">
      <div className="page-width section-space">
        <div className="own-grid">
          <h2 id="local-title" className="section-title">
            Your computer. Your AI. Your call.
          </h2>
          <div className="own-facts">
            <div>
              <h3 className="feature-title">Stored on your computer</h3>
              <p>
                Your board, profile notes, chats and packets live in a local folder. When an agent
                runs, the context it needs goes to the AI provider you chose.
              </p>
            </div>
            <div>
              <h3 className="feature-title">Runs on the AI you already have</h3>
              <p>
                Pitchcrew doesn’t sell an AI plan. Each agent can use a different tool and model,
                and usage follows your provider’s plan.
              </p>
            </div>
            <div>
              <h3 className="feature-title">Open source</h3>
              <p>
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
        <p className="runtime-list">
          <span className="runtime-label">Works with</span>
          {runtimes.map((runtime) => (
            <span key={runtime}>{runtime}</span>
          ))}
        </p>
      </div>
    </section>
  );
};

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
