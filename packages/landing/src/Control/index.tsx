import { HardDrive, SlidersHorizontal, ShieldCheck } from 'lucide-react';

const controls = [
  {
    icon: HardDrive,
    title: 'A workspace on your computer.',
    text: 'Your board, profile, chats, and application packets stay in local storage. AI runs send the context they need to your chosen provider.',
  },
  {
    icon: ShieldCheck,
    title: 'You make the calls.',
    text: 'Review applications before exporting. Browser assistance asks for approval for each action. Agent settings and profile changes stay under your control.',
  },
  {
    icon: SlidersHorizontal,
    title: 'A crew that works your way.',
    text: 'Choose your runtimes, edit agent instructions, assign skills, and set routines. Use Codex, Claude Code, Gemini CLI, and other supported tools.',
  },
];

export function Control() {
  return (
    <section id="control" className="page-width section-space" aria-labelledby="control-title">
      <div className="mb-12 grid gap-6 md:grid-cols-2 md:items-end">
        <h2 id="control-title" className="section-title">
          Help with the work.
          <br />
          Ownership of the decisions.
        </h2>
        <p className="section-copy max-w-md md:justify-self-end">
          Your job search is personal. Your workspace should respect that.
        </p>
      </div>
      <div className="grid gap-10 md:grid-cols-3 md:gap-12">
        {controls.map(({ icon: Icon, title, text }) => (
          <div key={title} className="border-t border-border pt-7">
            <Icon className="mb-5 text-primary" size={25} aria-hidden="true" />
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="mt-3 leading-relaxed text-muted">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
