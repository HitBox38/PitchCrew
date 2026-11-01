import { Roster } from '../Roster';

export const Hero = () => {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-intro page-width">
        <h1 id="hero-title">A crew for your job search.</h1>
        <div className="hero-copy">
          <p className="hero-lede">
            Scout finds the fit, Writer drafts from your notes, Reviewer checks every claim and
            Tracker follows up. You keep the final say.
          </p>
          <ul className="hero-facts" aria-label="What you need to know">
            <li>Free and open source under the MIT License.</li>
            <li>Runs on your Mac, Windows or Linux computer.</li>
            <li>Works with the AI tool you already use.</li>
          </ul>
        </div>
      </div>
      <Roster />
    </section>
  );
};
