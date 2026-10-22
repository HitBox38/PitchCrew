import { copyText } from '@/lib/clipboard.ts';
import { useCallback, useRef, useState } from 'react';
import { defaultViewerSettings, type ViewerFile, type ViewerSettings } from '../types.ts';
import { useDocumentFind } from './useDocumentFind.ts';
import { downloadFile } from '../attachments.ts';
export const useFileViewer = (
  files: ViewerFile[],
  initialIndex: number,
  close: (index: number) => void,
) => {
  const [index, setIndex] = useState(initialIndex);
  const file = files[index] ?? files[0]!;
  const [preferences, setPreferences] = useState<Record<string, ViewerSettings>>({});
  const settings = preferences[file.id] ?? defaultViewerSettings;
  const positionKey = `${file.id}:${settings.mode}`;
  const positions = useRef<Record<string, number>>({});
  const body = useRef<HTMLDivElement>(null);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const attachRoot = useCallback(
    (element: HTMLElement | null) => {
      setRoot(element);
      if (element && element.ownerDocument !== document)
        requestAnimationFrame(() => {
          const scrolling = element.ownerDocument.scrollingElement;
          if (scrolling) scrolling.scrollTop = positions.current[positionKey] ?? 0;
        });
    },
    [positionKey],
  );
  const [findOpen, setFindOpen] = useState(false);
  const [pages, setPages] = useState(0);
  const [searchable, setSearchable] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [visiblePage, setVisiblePage] = useState(1);
  const onPage = useCallback((page: number) => setVisiblePage(page), []);
  const onInfo = useCallback(
    (count: number, hasText?: boolean) => {
      setPages(count);
      if (hasText !== undefined) setSearchable(hasText);
      if (hasText === undefined)
        requestAnimationFrame(() => {
          if (body.current) body.current.scrollTop = positions.current[positionKey] ?? 0;
        });
    },
    [positionKey],
  );
  const savePosition = () => {
    const scrolling =
      root && root.ownerDocument !== document ? root.ownerDocument.scrollingElement : body.current;
    if (scrolling) positions.current[positionKey] = scrolling.scrollTop;
  };
  const find = useDocumentFind(root, `${file.id}:${settings.mode}`);
  const change = (patch: Partial<ViewerSettings>) => {
    if (patch.mode) savePosition();
    setPreferences((current) => ({ ...current, [file.id]: { ...settings, ...patch } }));
    if (patch.mode)
      requestAnimationFrame(() => {
        if (body.current)
          body.current.scrollTop = positions.current[`${file.id}:${patch.mode}`] ?? 0;
      });
  };
  const move = (next: number) => {
    if (next < 0 || next >= files.length) return;
    savePosition();
    setRoot(null);
    setIndex(next);
    if (files[next]?.kind === 'image') setFindOpen(false);
    setPages(0);
    setSearchable(null);
    setVisiblePage(1);
    setError('');
    requestAnimationFrame(() => {
      if (body.current)
        body.current.scrollTop =
          positions.current[
            `${files[next]!.id}:${preferences[files[next]!.id]?.mode ?? 'rendered'}`
          ] ?? 0;
    });
  };
  const openFind = () => {
    if (searchable === false) return;
    setFindOpen(true);
    requestAnimationFrame(() => find.focus());
  };
  const download = () => {
    try {
      downloadFile(file);
    } catch (reason) {
      setError(String(reason));
    }
  };
  return {
    file,
    files,
    index,
    move,
    settings,
    change,
    root,
    setRoot: attachRoot,
    find,
    findOpen,
    setFindOpen,
    openFind,
    attachBody: (element: HTMLDivElement | null) => {
      body.current = element;
    },
    pages,
    searchable,
    onInfo,
    visiblePage,
    onPage,
    error,
    download,
    copySelection: () => {
      const selected = root?.ownerDocument.getSelection()?.toString();
      if (selected) copyText(selected, 'Copied selection');
      else setError('Select document text to copy.');
    },
    closeFromFrame: () => {
      if (findOpen) setFindOpen(false);
      else close(index);
    },
  };
};
export type FileViewerModel = ReturnType<typeof useFileViewer>;
