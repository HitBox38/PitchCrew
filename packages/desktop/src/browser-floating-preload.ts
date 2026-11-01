import { ipcRenderer } from 'electron';

window.addEventListener('DOMContentLoaded', () => {
  const image = document.querySelector('img')!;
  ipcRenderer.on('pitchcrew:browser:float-status', (_event, message: string) => {
    document.querySelector('#status')!.textContent = message;
  });
  let viewport = { width: 1280, height: 800 };
  let sequence = 0;
  ipcRenderer.on(
    'pitchcrew:browser:float-frame',
    (_event, frame: { data: string; width: number; height: number }) => {
      viewport = frame;
      image.src = `data:image/png;base64,${frame.data}`;
    },
  );
  const point = (event: MouseEvent | WheelEvent) => {
    const rect = image.getBoundingClientRect();
    const scale = Math.min(rect.width / viewport.width, rect.height / viewport.height);
    const x = (event.clientX - rect.left - (rect.width - viewport.width * scale) / 2) / scale;
    const y = (event.clientY - rect.top - (rect.height - viewport.height * scale) / 2) / scale;
    return x >= 0 && y >= 0 && x < viewport.width && y < viewport.height
      ? { x: Math.floor(x), y: Math.floor(y) }
      : null;
  };
  for (const type of ['mousedown', 'mouseup', 'mousemove', 'wheel'] as const) {
    image.addEventListener(
      type,
      (event) => {
        event.preventDefault();
        const position = point(event);
        if (!position) return;
        if (type === 'mousemove' && ++sequence % 3) return;
        ipcRenderer.send('pitchcrew:browser:float-input', {
          type:
            type === 'wheel'
              ? 'mouseWheel'
              : type === 'mousedown'
                ? 'mouseDown'
                : type === 'mouseup'
                  ? 'mouseUp'
                  : 'mouseMove',
          ...position,
          button: event.button === 2 ? 'right' : event.button === 1 ? 'middle' : 'left',
          clickCount: Math.max(1, event.detail),
          ...(type === 'wheel'
            ? { deltaX: -(event as WheelEvent).deltaX, deltaY: -(event as WheelEvent).deltaY }
            : {}),
        });
      },
      { passive: false },
    );
  }
  document.addEventListener('contextmenu', (event) => event.preventDefault());
});
