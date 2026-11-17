import { useEffect, useRef, useState } from 'react';
import type { ViewerSettings } from '../types.ts';
import { readGutters } from '../gutters.ts';

/**
 * Sizes an image to its viewport: the fit (or actual size) within the tray's CSS gutters, turned
 * with the view's rotation, reported as the zoom menu's base scale.
 */
export const useImageFit = (settings: ViewerSettings, onScale: (scale: number) => void) => {
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [available, setAvailable] = useState({ width: 800, height: 600 });
  const [inset, setInset] = useState({ x: 64, y: 88 });
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setAvailable({ width: entry.contentRect.width, height: entry.contentRect.height });
      // The tray's CSS gutters frame the image, as they frame PDF and Word pages.
      const gutter = readGutters(entry.target);
      setInset({ x: gutter.x * 2, y: gutter.top + gutter.bottom });
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
      : Math.min((available.width - inset.x) / width, (available.height - inset.y) / height);
  const base = Math.max(0.01, fit);
  useEffect(() => onScale(base), [base, onScale]);
  const scale = (base * settings.zoom) / 100;
  return { viewport, size, setSize, width, height, inset, scale };
};
