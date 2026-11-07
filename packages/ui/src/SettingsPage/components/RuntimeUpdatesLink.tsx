import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';

export const RuntimeUpdatesLink = () => (
  <section className="ui-section settings-section" aria-label="Runtime updates">
    <div className="settings-list settings-preferences">
      <Link
        className="settings-row settings-link-row"
        to="/settings"
        search={{ section: 'runtimes' }}
      >
        <span>
          <strong>Runtime updates</strong>
          <span className="quiet block">Versions and updates for your installed agent CLIs.</span>
        </span>
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  </section>
);
