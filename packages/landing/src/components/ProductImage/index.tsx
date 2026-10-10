import Image from 'next/image';
import board from '../../../public/screenshots/board.png';
import chat from '../../../public/screenshots/chat.png';
import review from '../../../public/screenshots/review.png';
import boardDark from '../../../public/screenshots/board-dark.png';
import chatDark from '../../../public/screenshots/chat-dark.png';
import reviewDark from '../../../public/screenshots/review-dark.png';

const screenshots = { board, chat, review };
const darkScreenshots = { board: boardDark, chat: chatDark, review: reviewDark };

export function ProductImage({
  view,
  priority = false,
}: {
  view: 'board' | 'chat' | 'review';
  priority?: boolean;
}) {
  const descriptions = {
    board: 'Pitchcrew Board showing six fictional applications from new leads through interviews.',
    chat: 'A conversation with Scout in Pitchcrew, using a fictional candidate profile.',
    review:
      'Pitchcrew application review showing a fictional resume and supporting profile evidence.',
  };
  return (
    <div className="product-image">
      {(['light', 'dark'] as const).map((theme) => (
        <a
          key={theme}
          className={`themed-${theme}`}
          href={`/screenshots/${view}${theme === 'dark' ? '-dark' : ''}.png`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open full-size ${view} screenshot in a new tab`}
        >
          <Image
            src={theme === 'dark' ? darkScreenshots[view] : screenshots[view]}
            alt={descriptions[view]}
            sizes={
              view === 'board'
                ? '(max-width: 1200px) 92vw, 1184px'
                : '(max-width: 1024px) 92vw, 680px'
            }
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            quality={85}
          />
        </a>
      ))}
    </div>
  );
}
