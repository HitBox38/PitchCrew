import { createHash } from 'node:crypto';
import type { WebContents } from 'electron';
import { credentialSelector } from '../../../mcp/src/computer/credentials.ts';

/** Isolated-world listeners distinguish real human edits from website-prefilled answers. */
export const nativeManualFields = () => {
  const worlds = new Map<WebContents, Set<number>>();
  const fingerprints = new Map<string, string>();
  const begin = async (contents: WebContents, until: number) => {
    if (contents.isDestroyed()) return;
    const ids = worlds.get(contents) ?? new Set<number>();
    worlds.set(contents, ids);
    const tree = await contents.debugger.sendCommand('Page.getFrameTree');
    const frames: { frame: { id: string }; childFrames?: unknown[] }[] = [tree.frameTree];
    for (let i = 0; i < frames.length && i < 50; i++) {
      const frame = frames[i];
      if (frame.childFrames) frames.push(...(frame.childFrames as typeof frames));
      try {
        const { executionContextId } = await contents.debugger.sendCommand(
          'Page.createIsolatedWorld',
          { frameId: frame.frame.id, worldName: 'pitchcrew-private-input' },
        );
        ids.add(executionContextId);
        await contents.debugger.sendCommand('Runtime.evaluate', {
          contextId: executionContextId,
          expression: `(() => {
          if (!globalThis.__pitchcrewPrivateInput) {
            const edited = new WeakSet();
            const state = { until: 0, read: () => Array.from(document.querySelectorAll('input,textarea,select')).flatMap((field,index) => edited.has(field) && !field.matches(${JSON.stringify(credentialSelector)}) ? [{ url: document.URL, index, name: field.name, id: field.id, value: field.value }] : []) };
            for (const kind of ['input','change']) addEventListener(kind, (event) => { if (event.isTrusted && Date.now() < state.until && event.target instanceof Element) edited.add(event.target); }, true);
            Object.defineProperty(globalThis, '__pitchcrewPrivateInput', { value: state });
          }
          globalThis.__pitchcrewPrivateInput.until = ${until};
        })()`,
        });
      } catch {
        /* A navigating or detached frame receives fresh listeners when it loads. */
      }
    }
  };
  return {
    begin,
    flush: async () => {
      for (const [contents, ids] of worlds) {
        if (contents.isDestroyed()) {
          worlds.delete(contents);
          continue;
        }
        for (const contextId of ids) {
          const response = await contents.debugger
            .sendCommand('Runtime.evaluate', {
              contextId,
              returnByValue: true,
              expression: `(() => { const state=globalThis.__pitchcrewPrivateInput; if (!state) return []; state.until=0; return state.read(); })()`,
            })
            .catch(() => null);
          const fields = response?.result?.value as
            | { url: string; index: number; name: string; id: string; value: string }[]
            | undefined;
          if (!Array.isArray(fields)) {
            ids.delete(contextId);
            continue;
          }
          for (const field of fields) {
            if (typeof field.value !== 'string') continue;
            const value = field.value.normalize('NFKC').replace(/\s+/g, ' ').trim();
            const identity = { url: field.url, index: field.index, name: field.name, id: field.id };
            fingerprints.set(
              JSON.stringify(identity),
              createHash('sha256')
                .update(JSON.stringify({ ...identity, value }))
                .digest('hex'),
            );
            if (fingerprints.size > 1000) fingerprints.delete(fingerprints.keys().next().value!);
          }
        }
      }
      return [...fingerprints.values()];
    },
  };
};
