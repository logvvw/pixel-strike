/**
 * sound.js — Zero-dependency WebAudio engine for combat cues.
 *
 * A real gunshot is a three-part event: an initial sharp transient crack
 * (high-frequency noise burst), a low-frequency body thump (the pressure
 * wave), and a decaying tail (the room/report). We synthesize all three
 * procedurally with oscillators and filtered noise — no samples, no files,
 * no network.
 *
 * Every public method is a no-op when `AudioContext` is unavailable (Node,
 * test runners, headless browsers without audio). The context is created
 * lazily from the first user gesture to satisfy autoplay policies.
 */
const CATEGORIES = Object.freeze({
  sidearm: {
    crack: 2600, crackGain: 0.38, crackDuration: 0.015,
    body: 170, bodyGain: 0.42, bodyDuration: 0.07,
    tail: 0.05, tailGain: 0.16,
  },
  smg: {
    crack: 3400, crackGain: 0.32, crackDuration: 0.012,
    body: 230, bodyGain: 0.36, bodyDuration: 0.055,
    tail: 0.04, tailGain: 0.14,
  },
  shotgun: {
    crack: 1900, crackGain: 0.48, crackDuration: 0.022,
    body: 95, bodyGain: 0.55, bodyDuration: 0.14,
    tail: 0.12, tailGain: 0.22,
  },
  rifle: {
    crack: 2800, crackGain: 0.42, crackDuration: 0.016,
    body: 140, bodyGain: 0.45, bodyDuration: 0.085,
    tail: 0.06, tailGain: 0.18,
  },
  precision: {
    crack: 2200, crackGain: 0.44, crackDuration: 0.02,
    body: 85, bodyGain: 0.5, bodyDuration: 0.17,
    tail: 0.14, tailGain: 0.2,
  },
});

const HIT = Object.freeze({ base: 980, duration: 0.05, gain: 0.18, noise: 0.05 });
const HEADSHOT = Object.freeze({ base: 1320, duration: 0.06, gain: 0.22, noise: 0.06 });
const KILL = Object.freeze({ base: 540, second: 320, duration: 0.22, gain: 0.32 });

const DEFAULT_CATEGORY = CATEGORIES.rifle;

function hasWebAudio() {
  return typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
}

function createNoiseBuffer(ctx, durationSeconds) {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * durationSeconds));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function envelopeGain(ctx, start, peak, duration) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  return gain;
}

function playTone(ctx, { frequency, start, duration, gain, type = 'triangle' }) {
  const osc = ctx.createOscillator();
  const env = envelopeGain(ctx, start, gain, duration);
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  osc.frequency.exponentialRampToValueAtTime(
    Math.max(40, frequency * (type === 'sine' ? 0.35 : 0.55)),
    start + duration,
  );
  osc.connect(env).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function playNoise(ctx, { start, duration, gain, lowpass = 1200, highpass = 0 }) {
  const source = ctx.createBufferSource();
  source.buffer = createNoiseBuffer(ctx, duration);
  const filter = ctx.createBiquadFilter();
  if (highpass > 0) {
    filter.type = 'highpass';
    filter.frequency.value = highpass;
  } else {
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
  }
  const env = envelopeGain(ctx, start, gain, duration);
  source.connect(filter).connect(env).connect(ctx.destination);
  source.start(start);
  source.stop(start + duration + 0.02);
}

function playCrack(ctx, { start, frequency, duration, gain }) {
  // The transient: a very short, bright noise burst that sees little
  // low-pass filtering so it reads as the sharp initial "crack".
  playNoise(ctx, {
    start,
    duration,
    gain,
    highpass: frequency * 0.5,
  });
}

function playBody(ctx, { start, frequency, duration, gain }) {
  // The low-frequency thump: a fast-decaying sine pulse that carries the
  // physical impact of the round leaving the barrel.
  playTone(ctx, {
    frequency,
    start,
    duration,
    gain,
    type: 'sine',
  });
}

function playTail(ctx, { start, duration, gain }) {
  // The decaying room/report tail: shaped lowpass noise that fades out.
  playNoise(ctx, {
    start,
    duration,
    gain,
    lowpass: 900,
  });
}

export class SoundEngine {
  constructor({ contextFactory = null, masterGain = 0.65 } = {}) {
    this.contextFactory = contextFactory;
    this.masterGain = masterGain;
    this.context = null;
    this.master = null;
    this.muted = false;
  }

  arm() {
    if (this.context) return this.context;
    if (this.contextFactory) {
      this.context = safeContext(this.contextFactory());
    } else if (hasWebAudio()) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      this.context = safeContext(new Ctor());
    }
    if (!this.context) return null;
    this.master = this.context.createGain();
    this.master.gain.value = this.muted ? 0 : this.masterGain;
    this.master.connect(this.context.destination);
    return this.context;
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (this.master) this.master.gain.value = muted ? 0 : this.masterGain;
  }

  resume() {
    if (this.context && typeof this.context.resume === 'function') {
      this.context.resume().catch(() => {});
    }
  }

  fire(category = 'rifle') {
    const ctx = this.arm();
    if (!ctx) return;
    const profile = CATEGORIES[category] ?? DEFAULT_CATEGORY;
    const start = ctx.currentTime;

    // 1. Sharp transient crack
    playCrack(ctx, {
      start,
      frequency: profile.crack,
      duration: profile.crackDuration,
      gain: profile.crackGain,
    });

    // 2. Low-frequency body thump
    playBody(ctx, {
      start: start + 0.003,
      frequency: profile.body,
      duration: profile.bodyDuration,
      gain: profile.bodyGain,
    });

    // 3. Decaying tail
    playTail(ctx, {
      start: start + 0.008,
      duration: profile.tail,
      gain: profile.tailGain,
    });
  }

  hit(isHeadshot = false) {
    const ctx = this.arm();
    if (!ctx) return;
    const profile = isHeadshot ? HEADSHOT : HIT;
    const start = ctx.currentTime;
    playTone(ctx, {
      frequency: profile.base,
      start,
      duration: profile.duration,
      gain: profile.gain,
      type: 'square',
    });
    if (profile.noise > 0) {
      playNoise(ctx, {
        start,
        duration: profile.duration,
        gain: profile.noise,
        lowpass: profile.base * 1.5,
      });
    }
    if (isHeadshot) {
      playTone(ctx, {
        frequency: profile.base * 1.4,
        start: start + 0.04,
        duration: profile.duration * 0.6,
        gain: profile.gain * 0.7,
        type: 'triangle',
      });
    }
  }

  /**
   * Short UI tick for menu interactions (map select, button press).
   * Two-tone chirp: a bright triangle up top and a soft sine tail to give
   * the sound a tactile "click" character without adding noise.
   */
  select() {
    const ctx = this.arm();
    if (!ctx) return;
    const now = ctx.currentTime;
    playTone(ctx, {
      frequency: 1200,
      start: now,
      duration: 0.06,
      gain: 0.14,
      type: 'triangle',
    });
    playTone(ctx, {
      frequency: 600,
      start: now + 0.02,
      duration: 0.05,
      gain: 0.08,
      type: 'sine',
    });
  }

  kill(isHeadshot = false) {
    const ctx = this.arm();
    if (!ctx) return;
    const start = ctx.currentTime;
    playTone(ctx, {
      frequency: KILL.base,
      start,
      duration: KILL.duration,
      gain: KILL.gain,
      type: 'sawtooth',
    });
    playTone(ctx, {
      frequency: KILL.second,
      start: start + 0.08,
      duration: KILL.duration * 0.7,
      gain: KILL.gain * 0.8,
      type: 'triangle',
    });
    if (isHeadshot) {
      playTone(ctx, {
        frequency: 1200,
        start: start + 0.02,
        duration: 0.08,
        gain: 0.18,
        type: 'sine',
      });
    }
  }
}

function safeContext(ctx) {
  if (ctx && typeof ctx.createGain === 'function') return ctx;
  return null;
}

export const SOUND_CATEGORIES = CATEGORIES;
