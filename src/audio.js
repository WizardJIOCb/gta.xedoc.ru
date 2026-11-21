// Engine harmonics and an original short radio loop, synthesized on the client.
export function createAudio() {
  let ctx, master, engine, rumble, filter, engineGain, radio;
  let nextBeat = 0, step = 0, muted = false, active = false;
  const bass = [38, 38, 45, 48, 34, 34, 41, 44, 36, 36, 43, 46, 33, 33, 40, 43];
  const chords = [[53,57,60,64], [53,56,60,63], [55,58,62,65], [52,55,59,62]];
  function wake() {
    if (!ctx) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      ctx = new Audio(); master = ctx.createGain(); master.gain.value = 0;
      master.connect(ctx.destination);
      filter = ctx.createBiquadFilter(); filter.type = 'lowpass';
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      filter.connect(engineGain).connect(master);
      engine = ctx.createOscillator(); engine.type = 'sawtooth'; engine.connect(filter); engine.start();
      rumble = ctx.createOscillator(); rumble.type = 'triangle'; rumble.connect(filter); rumble.start();
      radio = ctx.createGain(); radio.gain.value = 0.68; radio.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }
  function note(when, hz, duration, gain, wave, endHz) {
    const osc = ctx.createOscillator(), env = ctx.createGain();
    osc.type = wave; osc.frequency.setValueAtTime(hz, when);
    if (endHz) osc.frequency.exponentialRampToValueAtTime(endHz, when + duration);
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(gain, when + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(env).connect(radio); osc.start(when); osc.stop(when + duration + 0.02);
    osc.onended = () => { osc.disconnect(); env.disconnect(); };
  }
  const freq = n => 440 * 2 ** ((n - 69) / 12);
  function update(speed, throttle, driving, paused) {
    if (!ctx) return;
    const now = ctx.currentTime;
    active = driving && !paused && !muted;
    master.gain.setTargetAtTime(active ? 0.55 : 0, now, 0.055);
    if (!active) { nextBeat = now; return; }
    const kmh = Math.abs(speed) * 3.6;
    const pitch = 34 + ((kmh / 29) % 1) * 31 + Math.min(1, kmh / 55) * 15 + (throttle ? 8 : 0);
    engine.frequency.setTargetAtTime(pitch, now, 0.13);
    rumble.frequency.setTargetAtTime(pitch * 0.5, now, 0.12);
    filter.frequency.setTargetAtTime(throttle ? 240 + kmh * 3 : 145 + kmh, now, 0.16);
    engineGain.gain.setTargetAtTime(throttle ? 0.095 : 0.052, now, 0.1);
    if (nextBeat < now) nextBeat = now + 0.01;
    while (nextBeat < now + 0.13) {
      const i = step % 32, chord = chords[Math.floor(i / 8)];
      if (i % 4 === 0) note(nextBeat, 125, 0.19, 0.23, 'sine', 43);
      if (i % 2 === 0) note(nextBeat, freq(bass[i / 2]), 0.22, 0.115, 'triangle');
      if (i % 4 === 2) note(nextBeat, 194, 0.09, 0.065, 'triangle', 85);
      if (i % 4 === 1) chord.forEach(n => note(nextBeat, freq(n), 0.58, 0.036, 'sine'));
      if (i % 8 === 7) note(nextBeat, freq(chord[3] + 12), 0.33, 0.037, 'triangle');
      nextBeat += 60 / 98 / 2; step++;
    }
  }
  function impact() {
    if (ctx && active) note(ctx.currentTime + 0.01, 105, 0.26, 0.31, 'sawtooth', 26);
  }
  return { wake, update, impact, mute(value) { muted = value; } };
}
