import test from 'node:test';
import assert from 'node:assert/strict';

import { loadBeforeInitialize } from '../js/engine/startup.js';
import { createRuntimeSessionController } from '../js/engine/session.js';

test('failed resource loading never runs listener-producing initialization', async () => {
  let initialized = 0;

  await assert.rejects(
    loadBeforeInitialize(
      async () => { throw new Error('map unavailable'); },
      () => { initialized++; },
    ),
    /map unavailable/,
  );

  assert.equal(initialized, 0);
});

test('successful resource loading is passed to initialization once', async () => {
  const resource = { grid: [[1]], meta: { ctSpawns: [] } };
  let received = null;

  await loadBeforeInitialize(async () => resource, value => { received = value; });

  assert.equal(received, resource);
});

function createControllerHarness(resolveDeployment = mapId => ({
  ok: true,
  definition: { id: mapId },
  grid: [[mapId]],
})) {
  const frames = [];
  const activations = [];
  const returns = [];
  const counts = {
    runtimes: 0,
    inputKeydownRegistrations: 0,
    updates: 0,
    renders: 0,
  };
  const runtime = { id: 'runtime' };
  const runtimeBase = { id: 'runtime-base' };
  const input = { id: 'input' };
  const controller = createRuntimeSessionController({
    resolveDeployment,
    createRuntimeBase() {
      counts.runtimes++;
      return runtimeBase;
    },
    createInput() {
      counts.inputKeydownRegistrations++;
      return input;
    },
    completeRuntime(context) {
      assert.equal(context.runtimeBase, runtimeBase);
      assert.equal(context.input, input);
      return runtime;
    },
    requestFrame(callback) {
      frames.push(callback);
      return frames.length;
    },
    onActiveUpdate() {
      counts.updates++;
    },
    onActiveRender() {
      counts.renders++;
    },
    onDeploy(context) {
      activations.push(context);
    },
    onReturn(context) {
      returns.push(context);
    },
  });

  return { controller, frames, activations, returns, counts, runtime };
}

test('runtime controller initializes one input keydown registration and one RAF chain', () => {
  const harness = createControllerHarness();

  const first = harness.controller.initialize();
  const second = harness.controller.initialize();

  assert.equal(first, harness.runtime);
  assert.equal(second, first);
  assert.deepEqual(harness.counts, {
    runtimes: 1,
    inputKeydownRegistrations: 1,
    updates: 0,
    renders: 0,
  });
  assert.equal(harness.frames.length, 1);
});

test('runtime controller keeps its RAF alive while skipping idle hub work', () => {
  const harness = createControllerHarness();
  harness.controller.initialize();

  harness.frames[0](16);

  assert.equal(harness.counts.updates, 0);
  assert.equal(harness.counts.renders, 0);
  assert.equal(harness.frames.length, 2);
});

test('runtime controller refuses invalid maps without activating or initializing', () => {
  const harness = createControllerHarness(() => ({
    ok: false,
    message: 'invalid generated map',
  }));

  const result = harness.controller.deploy('broken-map');

  assert.deepEqual(result, { ok: false, message: 'invalid generated map' });
  assert.equal(harness.controller.state.phase, 'hub');
  assert.equal(harness.counts.runtimes, 0);
  assert.equal(harness.frames.length, 0);
  assert.equal(harness.activations.length, 0);
});

test('deploy return and redeploy invalidate stale identity without duplicate runtime registration', () => {
  const harness = createControllerHarness();

  const first = harness.controller.deploy('ship-deck');
  const staleDeploymentId = first.state.deploymentId;
  harness.frames[0](16);
  const returned = harness.controller.returnToOperations();
  const second = harness.controller.deploy('ship-deck');

  assert.equal(first.ok, true);
  assert.equal(returned.phase, 'hub');
  assert.equal(second.ok, true);
  assert.equal(second.state.deploymentId, staleDeploymentId + 2);
  assert.equal(harness.controller.isDeploymentCurrent(staleDeploymentId), false);
  assert.equal(harness.controller.isDeploymentCurrent(second.state.deploymentId), true);
  assert.equal(harness.activations.length, 2);
  assert.equal(harness.returns.length, 1);
  assert.equal(harness.counts.runtimes, 1);
  assert.equal(harness.counts.inputKeydownRegistrations, 1);
  assert.equal(harness.frames.length, 2);
  assert.equal(harness.counts.updates, 1);
  assert.equal(harness.counts.renders, 1);
});

test('active redeploy resets run state for the same map on the existing runtime', () => {
  const harness = createControllerHarness();
  const first = harness.controller.deploy('ship-deck');

  const second = harness.controller.redeploy();

  assert.equal(second.ok, true);
  assert.deepEqual(second.state, {
    phase: 'active',
    deploymentId: first.state.deploymentId + 1,
    mapId: 'ship-deck',
    wave: 1,
    score: 0,
  });
  assert.equal(harness.counts.runtimes, 1);
  assert.equal(harness.counts.inputKeydownRegistrations, 1);
  assert.equal(harness.frames.length, 1);
});

test('runtime controller updates active wave and score without replacing deployment identity', () => {
  const harness = createControllerHarness();
  const deployed = harness.controller.deploy('ship-deck');

  const progressed = harness.controller.setRunProgress({ wave: 3, score: 700 });

  assert.deepEqual(progressed, {
    phase: 'active',
    deploymentId: deployed.state.deploymentId,
    mapId: 'ship-deck',
    wave: 3,
    score: 700,
  });
  assert.notEqual(progressed, deployed.state);
});
