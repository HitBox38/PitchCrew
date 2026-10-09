import { Brand } from '../components/Brand';
import { repository } from '../lib/links';
import { Theme } from '../Theme';

export function Header() {
  return (
    <header className="page-width flex items-center justify-between gap-3 py-6">
      <Brand />
      <nav
        aria-label="Main navigation"
        className="flex items-center gap-2 text-[15px] sm:gap-6 md:gap-8"
      >
        <a className="nav-link hidden sm:inline-flex" href="#workflow">
          How it works
        </a>
        <a className="nav-link hidden md:inline-flex" href="#control">
          Your control
        </a>
        <a className="nav-link hidden md:inline-flex" href="#faq">
          FAQ
        </a>
        <a className="nav-link hidden sm:inline-flex" href={repository}>
          GitHub
        </a>
        <Theme />
        <a className="button button-secondary header-download" href="#download">
          Download
        </a>
      </nav>
    </header>
  );
}
