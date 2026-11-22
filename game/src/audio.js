// A pocket synthesiser: every sound in the game is a few oscillators, so the game needs
// no audio files. Sounds stay silent until the first key or click unlocks the context.

let context = null;
let muted = false;

function ensureContext() {
  if (context === null) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    context = new AudioCtor();
  }
  if (context.state === 'suspended') context.resume();
  return context;
}

function tone(freqFrom, freqTo, seconds, type, gainValue, delay = 0) {
  if (muted) return;
  const ctx = ensureContext();
  if (!ctx) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqFrom, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqTo), start + seconds);
  gain.gain.setValueAtTime(gainValue, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + seconds + 0.02);
}

export const sfx = {
  unlock() { ensureContext(); },
  pickup() { tone(880, 1320, 0.09, 'triangle', 0.16); tone(1320, 1760, 0.12, 'triangle', 0.1, 0.05); },
  prize() { tone(660, 660, 0.1, 'triangle', 0.16); tone(880, 880, 0.1, 'triangle', 0.16, 0.09); tone(1320, 1320, 0.18, 'triangle', 0.16, 0.18); },
  spotted() { tone(220, 180, 0.16, 'sawtooth', 0.14); tone(220, 180, 0.16, 'sawtooth', 0.14, 0.18); },
  laser() { tone(1500, 300, 0.22, 'sawtooth', 0.12); },
  emp() { tone(1800, 60, 0.35, 'square', 0.1); },
  coin() { tone(1900, 1500, 0.07, 'sine', 0.14); tone(2400, 1900, 0.09, 'sine', 0.1, 0.06); },
  smoke() { tone(300, 90, 0.3, 'sine', 0.1); },
  caught() { tone(392, 392, 0.16, 'square', 0.12); tone(311, 311, 0.16, 'square', 0.12, 0.16); tone(233, 110, 0.4, 'square', 0.13, 0.32); },
  escaped() { tone(523, 523, 0.11, 'triangle', 0.15); tone(659, 659, 0.11, 'triangle', 0.15, 0.1); tone(784, 784, 0.11, 'triangle', 0.15, 0.2); tone(1046, 1046, 0.24, 'triangle', 0.16, 0.3); },
  tick() { tone(1200, 1200, 0.04, 'sine', 0.05); },
  toggleMute() { muted = !muted; return muted; },
  isMuted() { return muted; },
};
