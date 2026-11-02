import { ipcRenderer } from 'electron';

window.addEventListener('DOMContentLoaded', () => {
  const image = document.querySelector('img')!;
  const surface = document.querySelector<HTMLElement>('#surface')!;
  const stage = document.querySelector<HTMLElement>('#stage')!;
  const fit = document.querySelector<HTMLButtonElement>('#fit')!;
  const actual = document.querySelector<HTMLButtonElement>('#actual')!;
  const decrease = document.querySelector<HTMLButtonElement>('#out')!;
  const increase = document.querySelector<HTMLButtonElement>('#in')!;
  const label = document.querySelector('output')!;
  let mode: 'fit' | number = 'fit';
  let scale = 1;
  let viewport = { width: 0, height: 0 };
  const layout = () => {
    if (!viewport.width) return;
    const left = surface.scrollLeft;
    const top = surface.scrollTop;
    // Reset overflow before measuring so old scrollbars cannot shrink Fit repeatedly.
    stage.style.width = '100%';
    stage.style.height = '100%';
    image.style.width = '0';
    image.style.height = '0';
    scale =
      mode === 'fit'
        ? Math.min(1, surface.clientWidth / viewport.width, surface.clientHeight / viewport.height)
        : mode;
    image.style.width = `${viewport.width * scale}px`;
    image.style.height = `${viewport.height * scale}px`;
    stage.style.width = `${viewport.width * scale}px`;
    stage.style.height = `${viewport.height * scale}px`;
    surface.scrollTo(left, top);
    label.textContent = `${Math.round(scale * 100)}%`;
    fit.setAttribute('aria-pressed', String(mode === 'fit'));
    actual.setAttribute('aria-pressed', String(mode === 1));
    decrease.disabled = scale <= 0.25;
    increase.disabled = scale >= 2;
  };
  const setScale = (next: typeof mode) => {
    mode = next;
    surface.scrollTo(0, 0);
    layout();
  };
  fit.addEventListener('click', () => setScale('fit'));
  actual.addEventListener('click', () => setScale(1));
  decrease.addEventListener('click', () => setScale(Math.max(0.25, scale - 0.1)));
  increase.addEventListener('click', () => setScale(Math.min(2, scale + 0.1)));
  document.querySelector('#return')!.addEventListener('click', () => {
    ipcRenderer.send('pitchcrew:browser:float-close');
  });
  for (const type of ['keydown', 'keyup'] as const) {
    document.addEventListener(type, (event) => {
      // Decide ownership synchronously, before rapid keys can race a focus IPC.
      // F6 switches between page and toolbar; Tab keeps navigating the real form.
      if (event.key === 'F6') {
        event.preventDefault();
        if (type === 'keydown') {
          if (document.activeElement === image) fit.focus();
          else image.focus({ preventScroll: true });
        }
        return;
      }
      if (document.activeElement !== image) return;
      event.preventDefault();
      ipcRenderer.send('pitchcrew:browser:float-key', {
        type: type === 'keydown' ? 'keyDown' : 'keyUp',
        key: event.key,
        control: event.ctrlKey,
        meta: event.metaKey,
        alt: event.altKey,
        shift: event.shiftKey,
        isComposing: event.isComposing,
      });
    });
  }
  image.addEventListener('mousedown', () => image.focus({ preventScroll: true }));
  new ResizeObserver(layout).observe(surface);
  ipcRenderer.on('pitchcrew:browser:float-status', (_event, message: string) => {
    document.querySelector('#status')!.textContent = message;
  });
  let sequence = 0;
  image.addEventListener('load', () => {
    if (image.naturalWidth === viewport.width && image.naturalHeight === viewport.height) return;
    viewport = { width: image.naturalWidth, height: image.naturalHeight };
    layout();
  });
  ipcRenderer.on(
    'pitchcrew:browser:float-frame',
    (_event, frame: { data: string; width: number; height: number }) => {
      image.src = `data:image/png;base64,${frame.data}`;
    },
  );
  const point = (event: MouseEvent | WheelEvent) => {
    const rect = image.getBoundingClientRect();
    // The actual image rect includes centering, presentation scale and scroll offsets.
    const x = ((event.clientX - rect.left) / rect.width) * viewport.width;
    const y = ((event.clientY - rect.top) / rect.height) * viewport.height;
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
