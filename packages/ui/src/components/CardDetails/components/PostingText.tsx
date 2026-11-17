import { keyedItems } from '@/lib/list-keys.ts';

const bullet = /^\s*[-•*]\s/;

/**
 * The saved posting exactly as stored, one block per line, so list lines ("- ", "• ", "* ") can
 * hang their wrapped text under the words rather than the marker. Display only; copying keeps the
 * same lines.
 */
export const PostingText = ({ text }: { text: string }) => (
  <div className="detail-posting">
    {keyedItems(text.split('\n'), (line) => line).map(({ item: line, key }) => (
      <p key={key} data-bullet={bullet.test(line) ? '' : undefined}>
        {line || ' '}
      </p>
    ))}
  </div>
);
