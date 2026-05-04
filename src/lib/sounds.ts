// Synthesized sound effects using Web Audio API
let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

export function playPlayerShoot() {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(1200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.15);
}

export function playEnemyShoot() {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "triangle";
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.2);
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
}

export function playPlayerExplosion() {
  const ctx = getCtx();
  const bufferSize = ctx.sampleRate * 0.5;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2000, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.5);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  noise.start(ctx.currentTime);
  noise.stop(ctx.currentTime + 0.5);
}

export function playSiren(): () => void {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.value = 600;
  lfo.type = "sine";
  lfo.frequency.value = 4; // uuweee modulation rate
  lfoGain.gain.value = 250;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.06, ctx.currentTime);
  osc.start(ctx.currentTime);
  lfo.start(ctx.currentTime);
  return () => {
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.stop(t + 0.06);
    lfo.stop(t + 0.06);
  };
}

export function playTada() {
  const ctx = getCtx();
  const start = ctx.currentTime;
  const notes = [
    { f: 523.25, t: 0, d: 0.15 },   // C5 short
    { f: 523.25, t: 0.18, d: 0.5 },  // C5 long
  ];
  // Add a bright major chord on the long note
  const chord = [659.25, 783.99, 1046.5]; // E5, G5, C6
  for (const n of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(n.f, start + n.t);
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, start + n.t);
    gain.gain.exponentialRampToValueAtTime(0.18, start + n.t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + n.t + n.d);
    osc.start(start + n.t);
    osc.stop(start + n.t + n.d + 0.05);
  }
  for (const f of chord) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(f, start + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, start + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.1, start + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.7);
    osc.start(start + 0.18);
    osc.stop(start + 0.75);
  }
}

export function playRaverKill() {
  const ctx = getCtx();
  const start = ctx.currentTime;
  for (let i = 0; i < 5; i++) {
    const t = start + i * 0.08;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(1600, t);
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.start(t);
    osc.stop(t + 0.08);
  }
}

export function playEnemyExplosion() {
  const ctx = getCtx();
  const bufferSize = ctx.sampleRate * 0.15;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(3000, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  noise.start(ctx.currentTime);
  noise.stop(ctx.currentTime + 0.15);
}
