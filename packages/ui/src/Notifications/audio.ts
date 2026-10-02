let audio: AudioContext | undefined;
export function unlockNotificationAudio() {
  audio ??= new AudioContext();
  void audio.resume().catch(() => {});
}
export function playNotificationSound(kind: 'message' | 'attention') {
  try {
    audio ??= new AudioContext();
    void audio
      .resume()
      .then(() => {
        if (!audio || audio.state !== 'running') return;
        const tones = kind === 'attention' ? [659, 880, 659] : [523, 784];
        tones.forEach((frequency, index) => {
          const oscillator = audio!.createOscillator();
          const gain = audio!.createGain();
          const start = audio!.currentTime + index * 0.14;
          oscillator.type = 'sine';
          oscillator.frequency.value = frequency;
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.09, start + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
          oscillator.connect(gain);
          gain.connect(audio!.destination);
          oscillator.start(start);
          oscillator.stop(start + 0.2);
        });
      })
      .catch(() => {});
  } catch {
    /* Audio support is optional; the visual notification remains. */
  }
}
