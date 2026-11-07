/** Preserve terminal presentation, but never relay OSC/DCS/APC/PM/SOS side channels. */
export const terminalControlFilter = () => {
  let state: 'text' | 'escape' | 'csi' | 'string' = 'text';
  let sequence = '',
    stringEscape = false;
  return (chunk: string, accept: (raw: string, visible: boolean) => void) => {
    for (let index = 0; index < chunk.length; index++) {
      const character = chunk[index],
        code = character.charCodeAt(0);
      if (state === 'string') {
        if (
          code === 7 ||
          code === 0x9c ||
          code === 0x18 ||
          code === 0x1a ||
          (stringEscape && character === '\\')
        ) {
          state = 'text';
          stringEscape = false;
        } else stringEscape = code === 0x1b;
        continue;
      }
      if (state === 'escape') {
        if (sequence === '\x1b' && ']PX^_'.includes(character)) {
          state = 'string';
          stringEscape = false;
          sequence = '';
          continue;
        }
        if (sequence === '\x1b' && character === '[') {
          state = 'csi';
          sequence += character;
          continue;
        }
        if (code === 0x1b) {
          sequence = character;
          continue;
        }
        sequence += character;
        if (code >= 0x30 && code <= 0x7e) {
          accept(sequence, false);
          state = 'text';
          sequence = '';
        } else if (code < 0x20 || code > 0x2f || sequence.length > 1024) {
          state = 'text';
          sequence = '';
        }
        continue;
      }
      if (state === 'csi') {
        if (code === 0x1b) {
          state = 'escape';
          sequence = character;
          continue;
        }
        sequence += character;
        if (code >= 0x40 && code <= 0x7e) {
          accept(sequence, false);
          state = 'text';
          sequence = '';
        } else if (sequence.length > 1024 || code < 0x20 || code > 0x3f) {
          state = 'text';
          sequence = '';
        }
        continue;
      }
      if (code === 0x1b) {
        state = 'escape';
        sequence = character;
      } else if ([0x90, 0x98, 0x9d, 0x9e, 0x9f].includes(code)) {
        state = 'string';
        stringEscape = false;
      } else if (code === 0x9b) {
        state = 'csi';
        sequence = character;
      } else if (code !== 0 && code !== 0x7f)
        accept(character, code >= 0x20 || /[\n\r\t]/.test(character));
    }
  };
};
