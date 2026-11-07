import { useContext, useEffect, useId, useRef, useState, type ComponentProps } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { StreamdownContext, type ExtraProps } from 'streamdown';
import { ChatTableCopy } from './ChatTableCopy.tsx';

/** Keep the table intact; only its labelled viewport scrolls in a narrow conversation. */
export const ChatMarkdownTable = ({
  children,
  className,
  node: _node,
  ...props
}: ComponentProps<'table'> & ExtraProps) => {
  const viewport = useRef<HTMLElement>(null);
  const table = useRef<HTMLTableElement>(null);
  const hint = useId();
  const [overflow, setOverflow] = useState(false);
  const { isAnimating } = useContext(StreamdownContext);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => setOverflow(element.scrollWidth > element.clientWidth + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (table.current) observer.observe(table.current);
    measure();
    return () => observer.disconnect();
  }, []);
  return (
    <figure className="chat-markdown-table">
      <section
        ref={viewport}
        className="chat-table-viewport"
        data-streamdown="table-wrapper"
        aria-label="Table"
        aria-describedby={overflow ? hint : undefined}
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Arrow keys scroll overflowing table columns.
        tabIndex={overflow ? 0 : undefined}
      >
        <table {...props} ref={table} className={className} data-streamdown="table">
          {children}
        </table>
      </section>
      <figcaption className="chat-table-footer">
        {overflow ? (
          <span id={hint} className="chat-table-scroll-hint">
            <ArrowLeftRight size={14} aria-hidden="true" /> Scroll for more columns
          </span>
        ) : null}
        <ChatTableCopy table={table} disabled={isAnimating} />
      </figcaption>
    </figure>
  );
};
