import { useEffect, useRef, useState } from 'react';
import type { RuntimeId, RuntimeModel } from '@pitchcrew/core';

export const useModelEditor = (runtime: RuntimeId) => {
  const [editor, setEditor] = useState<RuntimeModel | 'new' | null>(null);
  const previous = useRef(editor);
  useEffect(() => {
    if (previous.current && !editor) {
      const row =
        previous.current === 'new'
          ? null
          : document.getElementById(`runtime-${runtime}-edit-${previous.current.value}`);
      (row ?? document.getElementById(`runtime-${runtime}-add-custom-model`))?.focus();
    }
    previous.current = editor;
  }, [editor, runtime]);
  return { editor, setEditor };
};
