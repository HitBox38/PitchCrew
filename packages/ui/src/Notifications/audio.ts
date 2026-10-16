let audio: AudioContext | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;
let soundUntil = 0;

function suspendWhenIdle(context: AudioContext, token: number, delay: number) {
  if (token !== generation) return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (token === generation) void context.suspend().catch(() => {});
  }, delay);
}

export function unlockNotificationAudio() {
  if (audio) return;
  audio = new AudioContext();
  const context = audio;
  const token = generation;
  void context
    .resume()
    .then(() => suspendWhenIdle(context, token, 100))
    .catch(() => {});
}
export function playNotificationSound(kind: 'message' | 'attention') {
  try {
    audio ??= new AudioContext();
    const context = audio;
    const token = ++generation;
    clearTimeout(idleTimer);
    void context
      .resume()
      .then(() => {
        if (context.state !== 'running' || token !== generation) return;
        const tones = kind === 'attention' ? [659, 880, 659] : [523, 784];
        tones.forEach((frequency, index) => {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          const start = context.currentTime + index * 0.14;
          oscillator.type = 'sine';
          oscillator.frequency.value = frequency;
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.09, start + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.onended = () => {
            oscillator.disconnect();
            gain.disconnect();
          };
          oscillator.start(start);
          oscillator.stop(start + 0.2);
        });
        soundUntil = Math.max(soundUntil, context.currentTime + (tones.length - 1) * 0.14 + 0.2);
        suspendWhenIdle(context, token, Math.max(0, soundUntil - context.currentTime) * 1000 + 50);
      })
      .catch(() => {});
  } catch {
    /* Audio support is optional; the visual notification remains. */
  }
}
