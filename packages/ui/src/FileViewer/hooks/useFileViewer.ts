import { copyText } from '@/lib/clipboard.ts';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { defaultViewerSettings, type ViewerFile, type ViewerSettings } from '../types.ts';
import { useDocumentFind } from './useDocumentFind.ts';
import { useViewerZoom } from './useViewerZoom.ts';
import { useReadingAnchor } from './useReadingAnchor.ts';
import { downloadFile } from '../attachments.ts';
import { applyScroll, readScroll, scrollerOf, type ScrollPosition } from '../scroller.ts';
export const useFileViewer = (
  files: ViewerFile[],
  initialIndex: number,
  close: (index: number) => void,
) => {
  const id = useId();
  const [index, setIndex] = useState(initialIndex);
  /** Expanded belongs to the viewer, not a file, so it survives moving between attachments. */
  const [expanded, setExpanded] = useState(false);
  const file = files[index] ?? files[0]!;
  const [preferences, setPreferences] = useState<Record<string, ViewerSettings>>({});
  const settings = preferences[file.id] ?? defaultViewerSettings;
  const positionKey = `${file.id}:${settings.mode}`;
  /** Each file and view's scroll position (both axes, for panned images). */
  const positions = useRef<Record<string, ScrollPosition>>({});
  const body = useRef<HTMLElement>(null);
  const findTrigger = useRef<HTMLButtonElement>(null);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const attachRoot = useCallback(
    (element: HTMLElement | null) => {
      setRoot(element);
      if (element && element.ownerDocument !== document)
        requestAnimationFrame(() =>
          applyScroll(element.ownerDocument.scrollingElement, positions.current[positionKey]),
        );
    },
    [positionKey],
  );
  const [pages, setPages] = useState(0);
  const [searchable, setSearchable] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  /** A renderer could not show the file: the notice line says so; navigation stays available. */
  const reportError = useCallback((message: string) => setError(message), []);
  const [visiblePage, setVisiblePage] = useState(1);
  const onPage = useCallback((page: number) => setVisiblePage(page), []);
  const onInfo = useCallback(
    (count: number, hasText?: boolean) => {
      setPages(count);
      if (hasText !== undefined) setSearchable(hasText);
      if (hasText === undefined)
        requestAnimationFrame(() => applyScroll(body.current, positions.current[positionKey]));
    },
    [positionKey],
  );
  const savePosition = () => {
    const scrolling = scrollerOf(body.current, root);
    if (scrolling) positions.current[positionKey] = readScroll(scrolling);
  };
  /** An image can only scroll once loaded, so its pan is restored then. */
  const onImageReady = useCallback(
    () =>
      requestAnimationFrame(() =>
        applyScroll(scrollerOf(body.current, null), positions.current[positionKey]),
      ),
    [positionKey],
  );
  // Highlights are a viewing aid while Find is open; closing Find clears them, keeping the query.
  const find = useDocumentFind(findOpen ? root : null, `${file.id}:${settings.mode}`);
  const anchor = useReadingAnchor(
    body,
    root,
    () => (findOpen ? find.active() : undefined),
    () => settings.rotation,
  );
  /** A pinch or Ctrl+wheel position to anchor the next zoom at, instead of the view centre. */
  const pinchPoint = useRef<{ x: number; y: number } | null>(null);
  const change = (patch: Partial<ViewerSettings>) => {
    if (patch.mode) savePosition();
    if (patch.zoom !== undefined || patch.fit !== undefined || patch.rotation !== undefined)
      anchor.capture(pinchPoint.current ?? undefined);
    pinchPoint.current = null;
    const pageRequest = settings.pageRequest + (patch.page === undefined ? 0 : 1);
    setPreferences((current) => ({
      ...current,
      [file.id]: { ...settings, ...patch, pageRequest },
    }));
    if (patch.mode)
      requestAnimationFrame(() =>
        applyScroll(body.current, positions.current[`${file.id}:${patch.mode}`]),
      );
  };
  const zoom = useViewerZoom(file, settings, change);
  // Trackpad pinch and Ctrl+wheel zoom the file at the pointer, never the app. The listener must
  // not be passive to stop the browser's own page zoom; pinch deltas add up to one preset step.
  const pinch = useRef({ delta: 0, step: (_event: WheelEvent) => {} });
  const zoomAt = (direction: 1 | -1, point?: { x: number; y: number }) => {
    pinchPoint.current = point ?? null;
    zoom.zoomBy(direction);
  };
  // Every Ctrl+wheel in the viewer is the viewer's, so the app never zooms; it anchors at the
  // pointer when that is over the document.
  pinch.current.step = (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    pinch.current.delta += event.deltaY;
    if (Math.abs(pinch.current.delta) < 40) return;
    const direction = pinch.current.delta < 0 ? 1 : -1;
    pinch.current.delta = 0;
    const over = body.current?.contains(event.target as Node);
    zoomAt(direction, over ? { x: event.clientX, y: event.clientY } : undefined);
  };
  const onWheel = useCallback((event: WheelEvent) => pinch.current.step(event), []);
  // After a zoom, fit or rotation re-lays out the document, put the reader's place back; once
  // more a frame later and after the Word frame or late page sizes settle.
  useEffect(() => {
    anchor.restore();
    const frame = requestAnimationFrame(anchor.restore);
    const settled = setTimeout(() => {
      anchor.restore();
      anchor.clear();
    }, 200);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settled);
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- Only geometry changes restore.
  }, [settings.zoom, settings.fit, settings.rotation]);
  const move = (next: number) => {
    if (next < 0 || next >= files.length || next === index) return;
    savePosition();
    setRoot(null);
    setIndex(next);
    if (files[next]?.kind === 'image') setFindOpen(false);
    setPages(0);
    setSearchable(null);
    setVisiblePage(1);
    setError('');
    zoom.resetBase();
    anchor.clear();
    requestAnimationFrame(() =>
      applyScroll(
        body.current,
        positions.current[`${files[next]!.id}:${preferences[files[next]!.id]?.mode ?? 'rendered'}`],
      ),
    );
  };
  const openFind = () => {
    if (searchable === false) return;
    setFindOpen(true);
    requestAnimationFrame(() => find.focus());
  };
  /** Closing Find hands focus back to its toolbar button, so viewer shortcuts keep working. */
  const closeFind = () => {
    // Focus moves before the field unmounts, so the dialog never sees focus lost.
    findTrigger.current?.focus();
    setFindOpen(false);
  };
  const download = () => {
    try {
      downloadFile(file);
    } catch (reason) {
      setError(String(reason));
    }
  };
  return {
    id,
    expanded,
    toggleExpanded: () => setExpanded((current) => !current),
    file,
    files,
    index,
    move,
    settings,
    change,
    zoom,
    root,
    setRoot: attachRoot,
    find,
    findOpen,
    attachFindTrigger: (element: HTMLButtonElement | null) => {
      findTrigger.current = element;
    },
    openFind,
    closeFind,
    attachBody: (element: HTMLElement | null) => {
      body.current
        ?.closest<HTMLElement>('[data-slot="dialog-content"]')
        ?.removeEventListener('wheel', onWheel);
      body.current = element;
      element
        ?.closest<HTMLElement>('[data-slot="dialog-content"]')
        ?.addEventListener('wheel', onWheel, { passive: false });
    },
    zoomAt,
    /** Where focus starts when the viewer opens: the document, not the first toolbar button. */
    initialFocus: () => body.current ?? true,
    pages,
    searchable,
    onInfo,
    onImageReady,
    visiblePage,
    onPage,
    error,
    download,
    /** Copies all the text the reader sees in the current view (the exact source in Source). */
    copyAll: () => {
      setError('');
      copyText(root?.innerText ?? file.text ?? '', 'Copied all text');
    },
    /** Copies the exact source text (Markdown, Word source or plain text). */
    copySource: () => {
      setError('');
      copyText(file.text ?? '', 'Copied exact source');
    },
    reportError,
    copySelection: () => {
      const selected = root?.ownerDocument.getSelection()?.toString();
      setError(selected ? '' : 'Select document text to copy.');
      if (selected) copyText(selected, 'Copied selection');
    },
    closeFromFrame: () => {
      if (findOpen) closeFind();
      else close(index);
    },
  };
};
export type FileViewerModel = ReturnType<typeof useFileViewer>;
