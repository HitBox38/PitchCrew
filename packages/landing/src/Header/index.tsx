import { Download } from 'lucide-react';
import { Brand } from '../components/Brand';
import { repository } from '../lib/links';
import { Theme } from '../Theme';

export function Header() {
  return (
    <header className="site-header">
      <Brand />
      <nav aria-label="Main navigation" className="site-nav">
        <a className="nav-link hidden md:inline-flex" href="#review">
          How it’s checked
        </a>
        <a className="nav-link hidden md:inline-flex" href="#crew">
          The crew
        </a>
        <a className="nav-link hidden lg:inline-flex" href="#faq">
          FAQ
        </a>
        <a className="nav-link hidden sm:inline-flex" href={repository}>
          GitHub
        </a>
        <Theme />
        <a className="button button-primary header-download" href="#download">
          <Download size={17} aria-hidden="true" />
          Download
        </a>
      </nav>
    </header>
  );
}
