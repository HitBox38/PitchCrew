import { useRef } from 'react';
import { useBrowserInput } from '../hooks/useBrowserInput.ts';
import type { BrowserViewProps } from '../types.ts';
export const BrowserView = (props: BrowserViewProps) => {
  const { frame, control, name } = props;
  const manual = props.manual && !props.panView;
  const image = useRef<HTMLButtonElement>(null);
  const input = useBrowserInput({ ...props, manual }, image);
  const scale =
    props.size.width && props.size.height
      ? Math.min(props.size.width / frame.width, props.size.height / frame.height) * props.zoom
      : props.zoom;
  return (
    <button
      type="button"
      className="browser-screen"
      style={{ width: frame.width * scale, height: frame.height * scale }}
      data-manual={manual}
      ref={image}
      tabIndex={manual ? 0 : -1}
      aria-label={
        manual
          ? `${name} browser. Click a field, then type. Tab moves between remote fields. Escape returns to controls. On touch devices, use Type on page.`
          : `${name}'s browser view`
      }
      onClick={input.click}
      onKeyDown={input.press}
      {...input.touch}
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
  );
};
