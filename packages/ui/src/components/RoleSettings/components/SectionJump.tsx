import type { RoleSettingsModel } from '../types.ts';

/** A compact sticky index of the panel's sections; each link scrolls its section into view. */
export const SectionJump = ({ creating, capabilities }: RoleSettingsModel) => {
  const sections = [
    ['agent-identity', 'Identity'],
    ['agent-runtime', 'Runtime'],
    ['agent-instructions', 'Instructions'],
    ['agent-tools', 'Tools'],
    ...(capabilities.computerUse ? [['agent-browser', 'Browser']] : []),
    ...(creating
      ? []
      : [
          ['agent-skills', 'Skills'],
          ['agent-memory', 'Memory'],
        ]),
  ];
  return (
    <nav className="agent-panel-jump" aria-label="Agent settings sections">
      {sections.map(([id, label]) => (
        <a
          key={id}
          href={`#${id}`}
          onClick={(event) => {
            event.preventDefault();
            const section = document.getElementById(id);
            section?.scrollIntoView({ block: 'start' });
            section?.querySelector<HTMLElement>('input, textarea, button, [tabindex]')?.focus({
              preventScroll: true,
            });
          }}
        >
          {label}
        </a>
      ))}
    </nav>
  );
};
