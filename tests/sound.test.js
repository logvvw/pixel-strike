import test from 'node:test';
import assert from 'node:assert/strict';

import { SoundEngine, SOUND_CATEGORIES } from '../js/engine/sound.js';

function createStubContext() {
  const created = [];
  let time = 0;
  let resumed = false;
  const ctx = {
    get sampleRate() { return 22050; },
    get currentTime() { return time; },
    get destination() { return { __destination: true }; },
    createGain() {
      const node = makeAudioNode('gain', created);
      return node;
    },
    createOscillator() {
      return makeAudioNode('osc', created);
    },
    createBiquadFilter() {
      return makeAudioNode('filter', created);
    },
    createBuffer(_channels, length) {
      return { length, getChannelData: () => new Float32Array(length) };
    },
    createBufferSource() {
      return makeAudioNode('source', created);
    },
    resume: () => { resumed = true; return Promise.resolve(); },
  };
  return {
    ctx,
    advance(seconds) { time += seconds; },
    nodes: created,
    isResumed: () => resumed,
    get lastGain() {
      const gains = created.filter(node => node.kind === 'gain');
      return gains[gains.length - 1];
    },
  };
}

function makeAudioNode(kind, registry) {
  const node = {
    kind,
    frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 0 },
    gain: {
      setValueAtTime() {},
      linearRampToValueAtTime(target) { node.gain.peak = target; },
      exponentialRampToValueAtTime() {},
      value: 0,
      peak: 0,
    },
    type: 'sine',
    buffer: null,
    connect(target) {
      node.target = target;
      return target;
    },
    start(when) { node.startAt = when; },
    stop(when) { node.stopAt = when; },
  };
  registry.push(node);
  return node;
}

test('SoundEngine is a no-op when no AudioContext is available', () => {
  const engine = new SoundEngine();
  assert.doesNotThrow(() => engine.fire('rifle'));
  assert.doesNotThrow(() => engine.hit(true));
  assert.doesNotThrow(() => engine.kill(false));
  assert.equal(engine.context, null);
});

test('SoundEngine arms lazily using the provided context factory', () => {
  const stub = createStubContext();
  const engine = new SoundEngine({ contextFactory: () => stub.ctx });
  engine.fire('sidearm');
  assert.equal(engine.context, stub.ctx);
  assert.ok(stub.nodes.length > 0);
  assert.ok(stub.nodes.some(node => node.kind === 'osc'));
});

test('fire uses category profile to synthesize crack, body, and tail segments', () => {
  const stub = createStubContext();
  const engine = new SoundEngine({ contextFactory: () => stub.ctx });
  engine.fire('shotgun');
  const profile = SOUND_CATEGORIES.shotgun;

  const voices = stub.nodes.filter(node => typeof node.stopAt === 'number');
  // crack + body + tail must each be scheduled as independent voices.
  assert.ok(voices.length >= 3, `expect at least 3 voices, got ${voices.length}`);

  // Each node's stop() adds a small 0.02s release buffer; measure the audible
  // span without it so assertions compare against the configured durations.
  const audibleSpan = node => node.stopAt - node.startAt - 0.02;

  // The body segment is the longest (the pressure-wave thump). At least one
  // voice must span the body duration so the impact reads clearly.
  const longestVoice = voices.reduce(
    (max, node) => Math.max(max, audibleSpan(node)),
    0,
  );
  assert.ok(
    longestVoice >= profile.bodyDuration * 0.8,
    `body voice (${longestVoice}) should approach bodyDuration (${profile.bodyDuration})`,
  );

  // The crack must be very short (the transient).
  const shortestVoice = voices.reduce(
    (min, node) => Math.min(min, audibleSpan(node)),
    Infinity,
  );
  assert.ok(
    shortestVoice < profile.crackDuration * 1.5,
    `crack voice (${shortestVoice}) should be a brief transient`,
  );
});

test('hit is louder and brighter on headshots than on body shots', () => {
  const bodyStub = createStubContext();
  const headStub = createStubContext();
  const body = new SoundEngine({ contextFactory: () => bodyStub.ctx });
  const head = new SoundEngine({ contextFactory: () => headStub.ctx });
  body.hit(false);
  head.hit(true);
  assert.ok(headStub.nodes.length > bodyStub.nodes.length,
    'headshot hit should schedule more voices (extra confirmation tone)');
  const headPeak = headStub.lastGain.gain.peak;
  const bodyPeak = bodyStub.lastGain.gain.peak;
  assert.ok(headPeak >= bodyPeak, 'headshot gain must dominate body hit gain');
});

test('kill schedules the kill chords even when no enemy is dying', () => {
  const stub = createStubContext();
  const engine = new SoundEngine({ contextFactory: () => stub.ctx });
  engine.kill(true);
  const oscs = stub.nodes.filter(node => node.kind === 'osc');
  assert.ok(oscs.length >= 3, 'headshot kill should add the confirmation chime');
});

test('muting silences the master gain', () => {
  const stub = createStubContext();
  const engine = new SoundEngine({ contextFactory: () => stub.ctx });
  engine.fire('rifle');
  // The first gain node is the master; subsequent gains are envelopes.
  const master = stub.nodes.find(node => node.kind === 'gain' && node.target?.__destination);
  assert.ok(master, 'master gain should be connected to the context destination');
  engine.setMuted(true);
  assert.equal(master.gain.value, 0);
  engine.setMuted(false);
  assert.equal(master.gain.value, engine.masterGain);
});

test('resume re-arms the context after autoplay restrictions', () => {
  const stub = createStubContext();
  const engine = new SoundEngine({ contextFactory: () => stub.ctx });
  engine.fire('rifle');
  engine.resume();
  assert.equal(stub.isResumed(), true);
});
