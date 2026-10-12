import { useRef } from 'react';
import { useBrowserInput } from '../hooks/useBrowserInput.ts';
import type { BrowserViewProps } from '../types.ts';
export function BrowserView(props: BrowserViewProps) {
  const { frame, manual, control, name } = props;
  const image = useRef<HTMLButtonElement>(null);
  const input = useBrowserInput(props, image);
  return (
    <div className="browser-live-view">
      <button
        type="button"
        className="browser-screen"
        ref={image}
        tabIndex={manual ? 0 : -1}
        aria-label={
          manual
            ? `${name} browser. Click a field, then type. Tab moves between remote fields; use the Return to controls button to leave.`
            : `${name}'s browser view`
        }
        onClick={input.click}
        onKeyDown={input.press}
        onPaste={(event) => {
          if (manual) {
            event.preventDefault();
            control.input({
              kind: 'text',
              text: event.clipboardData.getData('text').slice(0, 12000),
            });
          }
        }}
        onCompositionEnd={(event) => {
          if (manual) control.input({ kind: 'text', text: event.data });
        }}
      >
        <img
          src={`data:image/jpeg;base64,${frame.screenshot}`}
          alt={`${name}'s live browser`}
          width={frame.width}
          height={frame.height}
        />
      </button>
    </div>
  );
}
