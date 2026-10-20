import type { PacketArtifact } from '@pitchcrew/core';
import { useEffect, useRef, useState } from 'react';

export const useArtifactUrl = (artifact: PacketArtifact) => {
  const setOpened = (opened: boolean) => {
    if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
    activeUrl.current = '';
    if (opened) {
      const bytes = Uint8Array.from(atob(artifact.bytes), (character) => character.charCodeAt(0));
      activeUrl.current = URL.createObjectURL(new Blob([bytes], { type: artifact.mimeType }));
    }
    setUrl(activeUrl.current);
  };

  const [url, setUrl] = useState('');
  const activeUrl = useRef('');
  useEffect(
    () => () => {
      if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
    },
    [],
  );
  return { url, setOpened };
};
