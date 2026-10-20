import { Journey } from '../Journey';

export const Hero = () => {
  return (
    <section className="hero page-wide" aria-labelledby="hero-title">
      <div className="hero-intro">
        <h1 id="hero-title">Your job search, with a crew behind you.</h1>
        <p className="hero-description">
          Find openings, tailor applications from your own notes and track every one. Nothing made
          up, and nothing submitted without you.
        </p>
        <p className="hero-setup">Free and open source. Works with the AI tool you already use.</p>
      </div>
      <Journey />
    </section>
  );
};
