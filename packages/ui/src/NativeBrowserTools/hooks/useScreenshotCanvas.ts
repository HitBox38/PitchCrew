import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { DesktopBrowserCapture } from '../../../../core/src/native-browser.ts';
import { browserCaptureImage } from '../media.ts';

type Point = { x: number; y: number };

export const useScreenshotCanvas = (capture: DesktopBrowserCapture, note: string) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<HTMLImageElement | null>(null);
  const drawing = useRef<Point[] | null>(null);
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    void browserCaptureImage(capture).then(
      (next) => {
        if (!disposed) {
          image.current = next;
          setReady(true);
        }
      },
      (cause: unknown) => {
        if (!disposed) setError(cause instanceof Error ? cause.message : 'Screenshot failed.');
      },
    );
    return () => {
      disposed = true;
    };
  }, [capture]);
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context || !image.current || !ready) return;
    const font = Math.max(14, Math.round(capture.width / 70));
    context.font = `${font}px sans-serif`;
    const lines: string[] = [];
    for (const paragraph of note.split('\n')) {
      let line = '';
      for (const word of paragraph.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (context.measureText(next).width > capture.width - 32 && line) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      lines.push(line);
    }
    element.width = capture.width;
    element.height = capture.height + (note.trim() ? lines.length * font * 1.5 + 32 : 0);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, element.width, element.height);
    context.drawImage(image.current, 0, 0, capture.width, capture.height);
    context.strokeStyle = '#d13b35';
    context.lineWidth = Math.max(3, capture.width / 300);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    for (const stroke of strokes) {
      context.beginPath();
      stroke.forEach((point, index) => {
        if (!index) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.stroke();
    }
    context.font = `${font}px sans-serif`;
    context.fillStyle = '#222222';
    lines.forEach((line, index) =>
      context.fillText(line, 16, capture.height + 24 + (index + 0.5) * font * 1.5),
    );
  }, [capture, note, strokes, ready]);
  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * event.currentTarget.width,
      y: Math.min(
        capture.height,
        ((event.clientY - rect.top) / rect.height) * event.currentTarget.height,
      ),
    };
  };
  return {
    canvas,
    ready,
    error,
    strokes: strokes.length,
    undo: () => setStrokes((current) => current.slice(0, -1)),
    clear: () => setStrokes([]),
    begin: (event: PointerEvent<HTMLCanvasElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      drawing.current = [point(event)];
      setStrokes((current) => [...current, drawing.current!]);
    },
    move: (event: PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current) return;
      drawing.current = [...drawing.current, point(event)];
      setStrokes((current) => [...current.slice(0, -1), drawing.current!]);
    },
    end: () => {
      drawing.current = null;
    },
  };
};
