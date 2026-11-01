import { Download } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { Brand } from '../components/Brand';
import { repository } from '../lib/links';
import { Theme } from '../Theme';
import { Anchor } from '../components/clay/Anchor';

export const Header = () => {
  return (
    <header className="site-header page-width">
      <Brand />
      <nav aria-label="Main navigation" className="site-nav">
        <a className="nav-link hidden lg:inline-flex" href="#packet">
          How it’s checked
        </a>
        <a className="nav-link hidden lg:inline-flex" href="#journey">
          One job, start to finish
        </a>
        <a className="nav-link hidden lg:inline-flex" href="#faq">
          Questions
        </a>
        <a className="nav-link hidden sm:inline-flex" href={repository}>
          GitHub
        </a>
        <Theme />
        <Button
          render={<Anchor href="#download" />}
          nativeButton={false}
          className="header-download"
        >
          <Download aria-hidden="true" />
          Download
        </Button>
      </nav>
    </header>
  );
};
