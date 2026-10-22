import { useEffect, useRef, useState } from 'react';
import type { ViewerFile, ViewerSettings } from '../types.ts';
export const ImageDocument = ({
  file,
  settings,
}: {
  file: ViewerFile;
  settings: ViewerSettings;
}) => {
  const viewport = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [available, setAvailable] = useState({ width: 800, height: 600 });
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setAvailable({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    if (viewport.current) observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  const sideways = settings.rotation % 180 !== 0;
  const width = sideways ? size.height : size.width;
  const height = sideways ? size.width : size.height;
  const fit =
    settings.fit === 'actual'
      ? 1
      : Math.min((available.width - 48) / width, (available.height - 48) / height);
  const scale = (Math.max(0.01, fit) * settings.zoom) / 100;
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
          width: width * scale + 48,
          height: height * scale + 48,
          minWidth: '100%',
          minHeight: '100%',
        }}
      >
        <img
          src={`data:${file.mimeType};base64,${file.bytes}`}
          alt={file.name}
          draggable={false}
          onLoad={(event) =>
            setSize({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })
          }
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
