import { Analytics } from '../Analytics';
import { Brand } from '../components/Brand';
import { documentationUrl, repository } from '../lib/links';

export function Footer() {
  return (
    <footer className="page-width border-t border-border py-9">
      <div className="flex flex-wrap items-center justify-between gap-7">
        <Brand />
        <nav className="flex flex-wrap items-center gap-6 text-sm" aria-label="Footer navigation">
          <a className="text-link" href={repository}>
            GitHub
          </a>
          <a className="text-link" href={documentationUrl}>
            Documentation
          </a>
          <Analytics />
        </nav>
      </div>
      <p className="mt-6 text-sm text-muted">A little teamwork for your next chapter.</p>
    </footer>
  );
}
