import { ProductImage } from '../components/ProductImage';

export function ProductViews() {
  return (
    <section className="product-section section-space" aria-label="Inside Pitchcrew">
      <div className="page-width space-y-24 md:space-y-32">
        <div className="feature-row">
          <div className="feature-copy">
            <h2 className="section-title">
              Talk it through.
              <br />
              Keep the context.
            </h2>
            <p className="section-copy mt-6">
              Ask Scout about a role. Work through a draft with Writer. Bring the whole crew into
              the conversation.
            </p>
            <p className="mt-5 leading-relaxed text-muted">
              Attach an opportunity to a chat and keep the discussion with the work. Your crew can
              hand off tasks when you allow it.
            </p>
          </div>
          <figure>
            <ProductImage view="chat" />
            <figcaption className="screenshot-caption">
              Real crew chat with a fictional example profile.
            </figcaption>
          </figure>
        </div>
        <div className="feature-row feature-row-reverse">
          <div className="feature-copy">
            <h2 className="section-title">
              Your experience.
              <br />
              Carefully put into words.
            </h2>
            <p className="section-copy mt-6">
              A tailored application starts with what you have actually done. Review your resume,
              cover letter, and answers beside the evidence from your profile.
            </p>
            <p className="mt-5 leading-relaxed text-muted">
              Request changes, check the details, then approve a Markdown, PDF, or DOCX export. You
              have the final say.
            </p>
          </div>
          <figure>
            <ProductImage view="review" />
            <figcaption className="screenshot-caption">
              An actual application packet using fictional demo data.
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
