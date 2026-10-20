import type { ExtractedJob } from '@pitchcrew/core';

export const FlaggedSource = ({ items }: { items: ExtractedJob['flagged'] }) => {
  if (!items.length) return null;
  return (
    <section>
      <h4>Excluded or flagged source text</h4>
      <ul className="grid gap-2">
        {items.map((item, index) => (
          <li key={index}>
            <blockquote className="prewrap">{item.text}</blockquote>
            <p className="quiet">{item.reason}</p>
          </li>
        ))}
      </ul>
    </section>
  );
};
