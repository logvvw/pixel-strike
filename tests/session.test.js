import test from 'node:test';
import assert from 'node:assert/strict';

import {
  beginDeployment,
  createInitializeOnce,
  createSessionState,
  findWeaponIndexById,
  groupHitsByEntity,
  isDeploymentCurrent,
  resetRunState,
  returnToHub,
} from '../js/engine/session.js';

test('createSessionState returns the stable hub defaults', () => {
  assert.deepEqual(createSessionState(), {
    phase: 'hub',
    deploymentId: 0,
    mapId: null,
    wave: 1,
    score: 0,
  });
});

test('beginDeployment normalizes partial state without mutating it', () => {
  const previous = { deploymentId: 4, wave: 9 };

  const next = beginDeployment(previous, { id: 'ship-deck' });

  assert.deepEqual(next, {
    phase: 'active',
    deploymentId: 5,
    mapId: 'ship-deck',
    wave: 1,
    score: 0,
  });
  assert.deepEqual(previous, { deploymentId: 4, wave: 9 });
  assert.notEqual(next, previous);
});

test('session transitions treat explicitly undefined fields as missing', () => {
  assert.deepEqual(
    beginDeployment(
      { deploymentId: undefined, wave: undefined, score: undefined },
      { id: 'ship-deck' },
    ),
    {
      phase: 'active',
      deploymentId: 1,
      mapId: 'ship-deck',
      wave: 1,
      score: 0,
    },
  );
});

test('returnToHub invalidates the active deployment and clears run state', () => {
  const previous = {
    phase: 'active',
    deploymentId: 7,
    mapId: 'metro-core',
    wave: 6,
    score: 3200,
  };

  const next = returnToHub(previous);

  assert.deepEqual(next, {
    phase: 'hub',
    deploymentId: 8,
    mapId: null,
    wave: 1,
    score: 0,
  });
  assert.deepEqual(previous, {
    phase: 'active',
    deploymentId: 7,
    mapId: 'metro-core',
    wave: 6,
    score: 3200,
  });
});

test('resetRunState keeps the selected map and creates a fresh active run', () => {
  const previous = {
    phase: 'active',
    deploymentId: 11,
    mapId: 'desert-base',
    wave: 8,
    score: 9000,
  };

  const next = resetRunState(previous);

  assert.deepEqual(next, {
    phase: 'active',
    deploymentId: 12,
    mapId: 'desert-base',
    wave: 1,
    score: 0,
  });
  assert.deepEqual(previous, {
    phase: 'active',
    deploymentId: 11,
    mapId: 'desert-base',
    wave: 8,
    score: 9000,
  });
});

test('isDeploymentCurrent rejects stale ids and inactive sessions', () => {
  assert.equal(isDeploymentCurrent({ phase: 'active', deploymentId: 3 }, 3), true);
  assert.equal(isDeploymentCurrent({ phase: 'active', deploymentId: 3 }, 2), false);
  assert.equal(isDeploymentCurrent({ phase: 'hub', deploymentId: 3 }, 3), false);
  assert.equal(isDeploymentCurrent(undefined, 0), false);
});

test('groupHitsByEntity sums pellet damage and preserves any headshot per entity', () => {
  const firstEnemy = { id: 'first' };
  const secondEnemy = { id: 'second' };
  const hits = Object.freeze([
    Object.freeze({ entity: firstEnemy, damage: 12, isHeadshot: false }),
    Object.freeze({ entity: secondEnemy, damage: 8, isHeadshot: false }),
    Object.freeze({ entity: firstEnemy, damage: 24, isHeadshot: true }),
    Object.freeze({ entity: firstEnemy, damage: 12, isHeadshot: false }),
  ]);

  assert.deepEqual(groupHitsByEntity(hits), [
    { entity: firstEnemy, damage: 48, anyHeadshot: true },
    { entity: secondEnemy, damage: 8, anyHeadshot: false },
  ]);
});

test('groupHitsByEntity ignores entries without an entity or finite damage', () => {
  const enemy = { id: 'valid' };

  assert.deepEqual(groupHitsByEntity([
    null,
    { damage: 10, isHeadshot: true },
    { entity: enemy, damage: Number.NaN, isHeadshot: true },
    { entity: enemy, damage: 0, isHeadshot: false },
  ]), [
    { entity: enemy, damage: 0, anyHeadshot: false },
  ]);
  assert.deepEqual(groupHitsByEntity(undefined), []);
});

test('createInitializeOnce creates one runtime result across repeated calls', () => {
  let initializationCount = 0;
  const initialize = createInitializeOnce(() => ({ runtimeId: ++initializationCount }));

  const first = initialize();
  const second = initialize();

  assert.deepEqual(first, { runtimeId: 1 });
  assert.equal(second, first);
  assert.equal(initializationCount, 1);
});

test('findWeaponIndexById resolves a carried instance without accepting unknown ids', () => {
  const weapons = [{ id: 'pistol' }, { id: 'nova' }, { id: 'ak47' }];

  assert.equal(findWeaponIndexById(weapons, 'nova'), 1);
  assert.equal(findWeaponIndexById(weapons, 'awp'), -1);
  assert.equal(findWeaponIndexById(undefined, 'pistol'), -1);
});
