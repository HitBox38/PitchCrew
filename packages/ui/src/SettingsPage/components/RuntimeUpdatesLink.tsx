import { Link } from '@tanstack/react-router';
import { ArrowRight, Terminal } from 'lucide-react';

export const RuntimeUpdatesLink = () => (
  <section className="settings-section">
    <Link className="settings-related-link" to="/settings" search={{ section: 'runtimes' }}>
      <Terminal size={19} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <strong>Runtime updates</strong>
        <span className="quiet block">Check versions and update your installed agent CLIs.</span>
      </span>
      <ArrowRight size={17} aria-hidden="true" />
    </Link>
  </section>
);
