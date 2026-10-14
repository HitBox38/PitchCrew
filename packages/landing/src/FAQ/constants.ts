export const questions = [
  {
    question: 'Is Pitchcrew free?',
    answer:
      'Yes. Pitchcrew is free and open source under the MIT License. It runs agents through the AI tool and provider account you set up, so any subscription or usage charges belong to that provider. Pitchcrew does not sell an AI plan.',
  },
  {
    question: 'What do I need to get started?',
    answer:
      'Download the app, install and sign in to a supported AI tool, then choose it for your agents in Crew. Add factual notes about your experience in Profile and your first job on Board. The installer includes its own Node.js, local server and Chromium.',
  },
  {
    question: 'Which AI tools can I use?',
    answer:
      'Codex, Claude Code, Gemini CLI, OpenCode, GitHub Copilot CLI, Cursor Agent, Goose, Kiro CLI, Grok Build, Pi, oh-my-pi and Hermes Agent. Different agents can use different tools and models. Each tool needs its own installation and sign-in.',
  },
  {
    question: 'How does Pitchcrew keep the crew from making things up?',
    answer:
      'Writer has to quote your profile notes word for word for every claim, and Reviewer checks the whole packet against those notes and your packet rules before you see it. These checks are enforced by the app’s tools, not just by instructions. They catch invented facts; they are not a full proofread, so read your packet before approving it.',
  },
  {
    question: 'Will the crew apply to jobs without me?',
    answer:
      'No. You choose which jobs to pursue, and exports need your approval. Browser assistance is supervised by default. You can let an agent prepare forms on sites you approve, but submitting, pressing buttons or keys, and answering dialogs always wait for your decision. Sign-in and CAPTCHAs stay with you.',
  },
  {
    question: 'Can a job posting trick the agents?',
    answer:
      'Postings are treated as untrusted text. A separate step with no tools turns the posting into a job brief that you confirm, and the agents that write and review your application only see that confirmed brief, never the raw posting.',
  },
  {
    question: 'Does everything stay on my computer?',
    answer:
      'Your board, profile notes, chats and packets are stored locally. When an agent runs, the context it needs goes to the AI provider you chose, and connected accounts make requests when used, so AI runs are not offline. The app also counts anonymous feature usage, which you can turn off in Settings.',
  },
  {
    question: 'Can I bring applications I already sent?',
    answer:
      'Yes. Import past applications from a JSON or CSV export, or convert a supported older tracker. You review a preview before anything is added, and likely duplicates are skipped.',
  },
  {
    question: 'Why does my computer warn about the installer?',
    answer:
      'The current Windows and macOS installers are unsigned, and macOS builds are not notarized, so your system may ask for permission to open the app. Download from the linked GitHub release and check its checksums and setup notes.',
  },
];
