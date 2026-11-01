import { Analytics } from '../Analytics';
import { documentationUrl, licenseUrl, repository } from '../lib/links';

export const Footer = () => {
  return (
    <footer className="site-footer">
      <div className="page-width">
        <div className="footer-row">
          <p className="footer-name">Pitchcrew</p>
          <nav className="footer-nav" aria-label="Footer navigation">
            <a className="text-link" href={repository}>
              GitHub
            </a>
            <a className="text-link" href={documentationUrl}>
              Documentation
            </a>
            <a className="text-link" href={licenseUrl}>
              MIT License
            </a>
            <Analytics />
          </nav>
        </div>
        <p className="footer-line">
          Free and open source. Your notes, your AI, your final say. Every job on this page is
          fictional.
        </p>
      </div>
    </footer>
  );
};
