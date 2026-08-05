// audio.js — tiny 8-bit sound effects using the Web Audio API (no sound files needed)

let ctx;
function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function beep({ freq = 440, duration = 0.08, type = 'square', volume = 0.05 } = {}) {
  try {
    const audioCtx = getCtx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    // Audio can be blocked until the user interacts with the page — safe to ignore.
  }
}

export const sfx = {
  coin: () => { beep({ freq: 880, duration: 0.06 }); setTimeout(() => beep({ freq: 1318, duration: 0.08 }), 60); },
  levelUp: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep({ freq: f, duration: 0.12 }), i * 90)); },
  error: () => beep({ freq: 120, duration: 0.15, type: 'sawtooth', volume: 0.06 }),
  click: () => beep({ freq: 300, duration: 0.04, volume: 0.03 }),
  quest: () => { [660, 880, 1100].forEach((f, i) => setTimeout(() => beep({ freq: f, duration: 0.1 }), i * 80)); }
};

export function playIfEnabled(name, enabled) {
  if (!enabled) return;
  if (sfx[name]) sfx[name]();
}
