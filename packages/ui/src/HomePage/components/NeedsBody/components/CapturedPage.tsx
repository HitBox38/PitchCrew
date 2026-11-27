import { useId, useRef, useState } from 'react';
import { Lock, Maximize2 } from 'lucide-react';
import type { ComputerApproval } from '@pitchcrew/core';
import { FileViewer } from '@/FileViewer/index.tsx';
import { attachmentFiles } from '@/FileViewer/attachments.ts';
import { clockLabel } from '@/lib/time.ts';
import { capturedAddress } from '../helpers.ts';

/**
 * The page the agent holds, labelled as what it is: the page as captured when it asked. A recessed
 * well with the captured address along its top, then the frozen screenshot. The picture recedes
 * behind the verbs until pointed at; it is one button that opens the screenshot in the file viewer
 * (focus comes back to it), and its name is about the picture, never the control it shows.
 */
export const CapturedPage = ({ approval }: { approval: ComputerApproval }) => {
  const [viewing, setViewing] = useState(false);
  const frame = useRef<HTMLButtonElement>(null);
  const caption = useId();
  const files = attachmentFiles({ kind: 'browser', key: `browser:${approval.id}`, approval });
  const index = files.findIndex((file) => file.id === 'screenshot');
  const captured = clockLabel(approval.createdAt);
  if (index < 0)
    return (
      <figure className="needs-capture">
        <figcaption className="needs-capture-empty">No screenshot was captured</figcaption>
      </figure>
    );
  return (
    <figure className="needs-capture">
      <button
        ref={frame}
        type="button"
        className="needs-capture-frame"
        aria-label="Enlarge the captured page"
        aria-describedby={caption}
        onClick={() => setViewing(true)}
      >
        <span className="needs-capture-address" aria-hidden="true">
          <Lock size={12} />
          <span className="needs-capture-host">{capturedAddress(approval.page.url)}</span>
          <Maximize2 size={12} className="needs-capture-zoom" />
        </span>
        <span className="needs-capture-window">
          <img
            className="needs-capture-shot"
            src={`data:image/jpeg;base64,${approval.page.screenshot}`}
            alt=""
            width={approval.page.viewport?.width ?? 1280}
            height={approval.page.viewport?.height ?? 800}
          />
        </span>
      </button>
      <figcaption id={caption} className="needs-capture-caption">
        Page as captured at {captured}
      </figcaption>
      {viewing ? (
        <FileViewer
          files={files}
          initialIndex={index}
          description="Read-only captured page. Viewing it does not approve or reject the request."
          close={() => {
            setViewing(false);
            requestAnimationFrame(() => frame.current?.focus());
          }}
        />
      ) : null}
    </figure>
  );
};
