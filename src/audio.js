const STATIONS = [
  { name: '98.6 Sundown FM', file: 'sundown.m4a' },
  { name: '104.2 Radio Brisa', file: 'brisa.m4a' },
  { name: 'Радио выключено' }
];
const GEAR_RATIOS = [3.15, 2.22, 1.65, 1.27, 1.04, 0.86];
const UP_SHIFT = [9.5, 15, 21, 27, 33];
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));

function noiseBuffer(ctx) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 3.31), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// Short sounds are rendered once. Rapid impacts reuse buffers instead of
// allocating a new bank of envelopes and oscillators for every contact.
function makeEffect(ctx, kind) {
  const duration = { foot: .145, bump: .22, impact: .48, pulse: .56, gear: .105 }[kind];
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const out = buffer.getChannelData(0);
  let filtered = 0, phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / ctx.sampleRate, noise = Math.random() * 2 - 1;
    filtered += .17 * (noise - filtered);
    let value;
    switch (kind) {
      case 'foot':
        value = .47 * Math.sin(TAU * (76 * t + .9 * (1 - Math.exp(-t * 35)))) * Math.exp(-t * 35)
          + .38 * filtered * Math.exp(-t * 29);
        break;
      case 'bump':
        value = .74 * Math.sin(TAU * (45 * t + 1.7 * (1 - Math.exp(-t * 32)))) * Math.exp(-t * 21)
          + .39 * filtered * Math.exp(-t * 29);
        break;
      case 'impact':
        value = .68 * filtered * Math.exp(-t * 13) + .41 * Math.sin(TAU * 64 * t) * Math.exp(-t * 12)
          + .17 * Math.sin(TAU * 315 * t + 1.35 * Math.sin(TAU * 491 * t)) * Math.exp(-t * 14)
          + .27 * (noise - filtered) * Math.exp(-t * 43);
        break;
      case 'gear':
        value = (.52 * filtered + .18 * Math.sin(TAU * 126 * t)) * Math.exp(-t * 47);
        break;
      case 'pulse':
        // Descending FM sweep, bass impulse, then a high resonant tail.
        phase += TAU * (93 + 960 * Math.exp(-t * 16)) / ctx.sampleRate;
        value = .42 * Math.sin(phase + 2.6 * Math.exp(-t * 12) * Math.sin(phase * 1.53)) * Math.exp(-t * 8)
          + .52 * Math.sin(TAU * (53 * t + 1.9 * (1 - Math.exp(-t * 20)))) * Math.exp(-t * 11)
          + .22 * filtered * Math.exp(-t * 22) + .11 * Math.sin(phase * 2.49) * Math.exp(-t * 5);
    }
    out[i] = value * Math.min(1, t * 500, (duration - t) * 130);
  }
  return buffer;
}

function channel(ctx, output, pan = 0) {
  const gain = ctx.createGain(); gain.gain.value = 0;
  const panner = ctx.createStereoPanner(); panner.pan.value = pan;
  gain.connect(panner).connect(output);
  return { gain, panner };
}

function oscillator(ctx, destination, type, frequency) {
  const source = ctx.createOscillator();
  if (typeof type === 'string') source.type = type;
  else source.setPeriodicWave(type);
  source.frequency.value = frequency;
  source.connect(destination); source.start();
  return source;
}

function noiseLayer(ctx, output, buffer, type, hz, q, pan, rate) {
  const layer = channel(ctx, output, pan), filter = ctx.createBiquadFilter();
  filter.type = type; filter.frequency.value = hz; filter.Q.value = q;
  const source = ctx.createBufferSource(); source.buffer = buffer; source.loop = true;
  source.playbackRate.value = rate;
  source.connect(filter).connect(layer.gain);
  source.start(0, Math.random() * buffer.duration);
  return { ...layer, filter };
}

const set = (param, value, now, lag = .075) => param.setTargetAtTime(value, now, lag);

export function createAudio() {
  let ctx, master, mixer, engine, exhaust, intake, intakeFilter, sub, whine, driveWhine;
  let air, tire, tireNote, road, surf, coastWind, traffic, radioGain, radioSource;
  let stationIndex = 0, radioBegan = 0, radioOffset = 0, gear = 0, shiftingUntil = 0;
  let lastStep = 0, stepSide = 1, muted = false, gamePaused = false, inCar = false;
  const decoded = new Map(), buffers = new Map(), effects = new Map();

  function wake() {
    if (!ctx) {
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Audio) return;
      ctx = new Audio({latencyHint: 'interactive'});
      master = ctx.createGain(); master.gain.value = 0;
      mixer = ctx.createDynamicsCompressor();
      mixer.threshold.value = -10; mixer.knee.value = 13; mixer.ratio.value = 5;
      mixer.attack.value = .004; mixer.release.value = .17;
      mixer.connect(master).connect(ctx.destination);
      radioGain = ctx.createGain(); radioGain.gain.value = .62; radioGain.connect(mixer);
      engine = channel(ctx, mixer, -.08);
      intakeFilter = ctx.createBiquadFilter(); intakeFilter.frequency.value = 540;
      intakeFilter.Q.value = .62; intakeFilter.connect(engine.gain);
      const waveform = ctx.createPeriodicWave(new Float32Array(10),
        new Float32Array([0,1,.40,.28,.14,.20,.06,.08,.05,.04]));
      exhaust = oscillator(ctx, intakeFilter, waveform, 54);
      intake = oscillator(ctx, intakeFilter, 'triangle', 107);
      intake.detune.value = 4;
      sub = oscillator(ctx, engine.gain, 'sine', 27);
      driveWhine = channel(ctx, mixer, .12);
      whine = oscillator(ctx, driveWhine.gain, 'sine', 170);
      const noise = noiseBuffer(ctx);
      air = noiseLayer(ctx, mixer, noise, 'bandpass', 510, .82, .06, 1.07);
      road = noiseLayer(ctx, mixer, noise, 'lowpass', 580, .65, -.12, .92);
      tire = noiseLayer(ctx, mixer, noise, 'bandpass', 1480, 2.1, 0, 1.13);
      tireNote = channel(ctx, mixer);
      tireNote.tone = oscillator(ctx, tireNote.gain, 'triangle', 730);
      surf = noiseLayer(ctx, mixer, noise, 'lowpass', 1200, .60, .68, .82);
      coastWind = noiseLayer(ctx, mixer, noise, 'highpass', 2600, .62, -.40, 1.20);
      traffic = noiseLayer(ctx, mixer, noise, 'bandpass', 390, .85, -.4, .72);
    }
    if (ctx.state === 'suspended' || ctx.state === 'interrupted') ctx.resume().catch(() => {});
  }

  function playEffect(kind, volume, pan = 0, rate = 1) {
    if (!ctx || gamePaused || muted) return;
    if (!effects.has(kind)) effects.set(kind, makeEffect(ctx, kind));
    const voice = ctx.createBufferSource(), gain = ctx.createGain(), stereo = ctx.createStereoPanner();
    voice.buffer = effects.get(kind); voice.playbackRate.value = rate;
    gain.gain.value = volume; stereo.pan.value = pan;
    voice.connect(gain).connect(stereo).connect(mixer);
    voice.onended = () => { voice.disconnect(); gain.disconnect(); stereo.disconnect(); };
    voice.start();
  }

  function stopRadio() {
    if (!radioSource) return;
    radioOffset = (radioOffset + ctx.currentTime - radioBegan) % radioSource.buffer.duration;
    radioSource.stop(); radioSource.disconnect(); radioSource = null;
  }
  function syncRadio() {
    const file = STATIONS[stationIndex].file;
    if (!inCar || gamePaused || muted || !file) { stopRadio(); return; }
    if (radioSource) return;
    if (!buffers.has(file)) {
      if (!decoded.has(file)) {
        const url = new URL('audio/' + file, document.baseURI);
        const request = fetch(url).then(response => {
          if (!response.ok) throw new Error('Radio track unavailable');
          return response.arrayBuffer();
        }).then(bytes => ctx.decodeAudioData(bytes)).then(buffer => {
          buffers.set(file, buffer); syncRadio();
        }).catch(() => {});
        decoded.set(file, request);
      }
      return;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffers.get(file); source.loop = true;
    source.connect(radioGain);
    radioBegan = ctx.currentTime;
    source.start(0, radioOffset % source.buffer.duration);
    radioSource = source;
  }
  function nextStation() {
    stopRadio(); radioOffset = 0;
    stationIndex = (stationIndex + 1) % STATIONS.length;
    if (ctx) syncRadio();
    return STATIONS[stationIndex].name;
  }
  function mute(value) {
    muted = Boolean(value);
    if (!ctx) return;
    set(master.gain, muted || gamePaused ? 0 : .80, ctx.currentTime, .015);
    syncRadio();
  }
  function update(speed, throttle, driving, paused, extra = {}) {
    inCar = Boolean(driving); gamePaused = Boolean(paused);
    if (!ctx) return;
    const now = ctx.currentTime;
    set(master.gain, (paused || muted) ? 0 : .80, now, .02);
    syncRadio();
    if (paused || muted) { lastStep = now; return; }
    const v = Math.abs(speed), load = inCar && throttle ? 1 : 0;
    if (inCar && speed > 0 && now >= shiftingUntil) {
      const up = gear < UP_SHIFT.length && v > UP_SHIFT[gear];
      const down = gear > 0 && v < UP_SHIFT[gear - 1] * .78;
      if (up || down) {
        gear += up ? 1 : -1; shiftingUntil = now + .16;
        playEffect('gear', .21, -.12, up ? 1.03 : .88);
      }
    } else if (!inCar || speed < 0) { gear = 0; }
    const shifting = now < shiftingUntil;
    const rpm = clamp(810 + v * 108 * GEAR_RATIOS[gear] + load * 330, 810, 6900);
    const fire = rpm / 15 + 1.3 * Math.sin(now * 9.1);
    set(exhaust.frequency, fire, now); set(intake.frequency, fire * 2.02, now);
    set(sub.frequency, fire / 2, now);
    set(intakeFilter.frequency, 300 + rpm * .22 + load * 520, now);
    set(engine.gain.gain, inCar ? (shifting ? .041 : .069 + .043 * load) : 0, now, .05);
    set(whine.frequency, 80 + v * 15, now);
    set(driveWhine.gain.gain, inCar ? .014 * Math.min(v / 12, 1) : 0, now);
    set(air.filter.frequency, extra.nitro ? 1700 : 450 + .15 * rpm, now);
    set(air.gain.gain, inCar ? .022 + .062 * load + (extra.nitro ? .20 : 0) : 0, now);
    set(road.gain.gain, inCar ? Math.min(v * .005, .12) : 0, now);
    const steer = clamp(extra.steer || 0, -1, 1);
    const slip = inCar ? clamp((Math.abs(steer) * v * .18 - .55) + (extra.handbrake ? v * .18 : 0), 0, 1) : 0;
    set(tire.gain.gain, .27 * slip, now, .045); set(tire.panner.pan, steer * .52, now);
    set(tireNote.gain.gain, .046 * slip, now, .055);
    set(tireNote.tone.frequency, 600 + 165 * slip + 27 * Math.sin(now * 22), now, .035);
    const coast = clamp(((extra.x ?? 0) + 45) / 75, .06, 1);
    const swell = .5 + .33 * Math.sin(now * .73) + .15 * Math.sin(now * 1.17 + .8);
    const outside = inCar ? .37 : 1;
    set(surf.gain.gain, (.11 + .25 * swell) * coast * outside, now, .18);
    set(surf.filter.frequency, 650 + 1550 * swell, now, .14);
    set(coastWind.gain.gain, (.022 + .034 * swell) * coast * outside, now, .19);
    const pass = Math.max(0, Math.cos(now * .44 + (extra.z ?? 0) * .012)) ** 8;
    set(traffic.gain.gain, (.013 + .115 * pass) * outside, now, .16);
    set(traffic.filter.frequency, 235 + 410 * pass, now);
    set(traffic.panner.pan, .72 * Math.sin(now * .44), now, .20);
    if (!inCar && extra.walking && now - lastStep > (extra.running ? .29 : .40)) {
      lastStep = now; stepSide *= -1;
      playEffect('foot', .27, .20 * stepSide, .96 + Math.random() * .11);
    }
  }
  return { wake, update, mute, nextStation, station: () => STATIONS[stationIndex].name,
    pulse: () => playEffect('pulse', .82), bump: () => playEffect('bump', .69),
    impact: () => playEffect('impact', .91, -.08, .91 + Math.random() * .15) };
}
