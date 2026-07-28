// Web Audio API oscillator beep — no binary asset in the repo. Browsers
// block AudioContext output until it's created/resumed synchronously inside
// a user-gesture handler, but the beep itself fires later, asynchronously,
// from the rest timer's setInterval tick (not a click). primeAudio() is
// called synchronously from the "Log set" click (still a real user gesture,
// even though the function that calls it is async) to unlock playback ahead
// of time; playBeep() then just reuses the already-unlocked context.
let audioCtx: AudioContext | null = null;

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext ?? null;
}

export function primeAudio(): void {
  if (!audioCtx) {
    const Ctor = getAudioContextCtor();
    if (!Ctor) return;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

export function playBeep(): void {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.3, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.3);
}
