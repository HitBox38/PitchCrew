import { Download } from 'lucide-react';
import { ProductImage } from '../components/ProductImage';
import { Reveal } from '../components/Reveal';
import { repository } from '../lib/links';

export function Hero() {
  return (
    <section className="page-width hero" aria-labelledby="hero-title">
      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-end lg:gap-20">
        <h1 id="hero-title">
          Your job search,
          <br />
          with a crew
          <br className="hidden lg:block" /> behind you.
        </h1>
        <div className="hero-intro">
          <p className="section-copy">
            An AI crew to find promising roles, tailor applications, and track your job search. You
            stay in control.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-5">
            <a className="button button-primary" href="#download">
              <Download size={18} aria-hidden="true" />
              Download Pitchcrew
            </a>
            <a className="text-link" href={repository}>
              View on GitHub
            </a>
          </div>
          <p className="mt-4 text-sm text-muted">Free to download. Your AI tools. Your computer.</p>
        </div>
      </div>
      <Reveal className="mt-12 md:mt-16">
        <figure>
          <div className="preview-heading">
            <span className="flex items-center gap-2">
              <span className="status-dot" />
              One workspace for your next chapter
            </span>
            <span className="hidden text-sm text-muted sm:block">
              From first lead to next interview
            </span>
          </div>
          <ProductImage view="board" priority />
          <figcaption className="mt-4 flex flex-wrap justify-between gap-2 text-sm text-muted">
            <span>Your opportunities, applications, and crew—together.</span>
            <span>Actual app. Fictional demo data.</span>
          </figcaption>
        </figure>
      </Reveal>
    </section>
  );
}
