import { useRef, useState } from 'react';
import type { ViewerFile, ViewerSettings } from '../types.ts';
import { useImageFit } from '../hooks/useImageFit.ts';
export const ImageDocument = ({
  file,
  settings,
  onScale,
  onReady,
  onError,
}: {
  file: ViewerFile;
  settings: ViewerSettings;
  onScale: (scale: number) => void;
  /** Called once the image has its size, so its pan position can be restored. */
  onReady: () => void;
  onError: (message: string) => void;
}) => {
  const pointer = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const { viewport, size, setSize, width, height, inset, scale } = useImageFit(settings, onScale);
  const [failed, setFailed] = useState(false);
  return (
    <div
      className="file-image-viewport"
      ref={viewport}
      onPointerDown={(event) => {
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        pointer.current = {
          x: event.clientX,
          y: event.clientY,
          left: event.currentTarget.scrollLeft,
          top: event.currentTarget.scrollTop,
        };
      }}
      onPointerMove={(event) => {
        if (!pointer.current) return;
        event.currentTarget.scrollLeft = pointer.current.left - event.clientX + pointer.current.x;
        event.currentTarget.scrollTop = pointer.current.top - event.clientY + pointer.current.y;
      }}
      onPointerUp={() => {
        pointer.current = null;
      }}
      onPointerCancel={() => {
        pointer.current = null;
      }}
    >
      <div
        className="file-image-size"
        style={{
          width: width * scale + inset.x,
          height: height * scale + inset.y,
          minWidth: '100%',
          minHeight: '100%',
        }}
      >
        {failed ? <p className="file-view-loading">Image preview unavailable.</p> : null}
        <img
          hidden={failed}
          src={`data:${file.mimeType};base64,${file.bytes}`}
          alt={file.name}
          draggable={false}
          onLoad={(event) => {
            setSize({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            });
            onReady();
          }}
          onError={() => {
            setFailed(true);
            onError('This image couldn’t be opened. The file may be damaged.');
          }}
          style={{
            width: size.width * scale,
            height: size.height * scale,
            transform: `translate(-50%, -50%) rotate(${settings.rotation}deg)`,
          }}
        />
      </div>
    </div>
  );
};
