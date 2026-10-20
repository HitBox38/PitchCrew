import { ChatDemo } from './components/ChatDemo';

export const WatchItWork = () => {
  return (
    <section className="page-width section-space" aria-labelledby="watch-title">
      <div className="section-head">
        <h2 id="watch-title" className="section-title">
          Watch the work, not a spinner.
        </h2>
        <p className="section-copy">
          Talk with any agent about a role or a draft. Progress arrives in plain language, every
          step is grouped so you can check it, and you can stop or redirect a run from the message
          box.
        </p>
      </div>
      <figure className="watch-figure">
        <ChatDemo />
        <figcaption className="screenshot-caption">
          Built from Pitchcrew’s own chat components with a fictional conversation. Open the steps
          to see each one.
        </figcaption>
      </figure>
    </section>
  );
};
