import type { PacketArtifact } from '@pitchcrew/core';
import { useEffect, useRef, useState } from 'react';

export function useArtifactUrl(artifact: PacketArtifact) {
  const [url, setUrl] = useState('');
  const activeUrl = useRef('');
  useEffect(
    () => () => {
      if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
    },
    [],
  );
  function setOpened(opened: boolean) {
    if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
    activeUrl.current = '';
    if (opened) {
      const bytes = Uint8Array.from(atob(artifact.bytes), (character) => character.charCodeAt(0));
      activeUrl.current = URL.createObjectURL(new Blob([bytes], { type: artifact.mimeType }));
    }
    setUrl(activeUrl.current);
  }
  return { url, setOpened };
}
