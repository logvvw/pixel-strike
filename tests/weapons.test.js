import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WEAPONS,
  createWeapon,
  getEffectiveSpread,
  tryFire,
  updateWeaponHandling,
} from '../js/weapons/weapons.js';
import { Player } from '../js/engine/player.js';

const openMap = Array.from({ length: 7 }, (_, y) =>
  Array.from({ length: 7 }, (_, x) => (
    x === 0 || y === 0 || x === 6 || y === 6 ? 1 : 0
  )),
);

test('weapon catalog exposes all approved store weapons in progression order', () => {
  const expected = [
    ['pistol', 'Glock-18', 'SIDEARM', 0],
    ['usp', 'USP-S', 'SIDEARM', 400],
    ['deagle', 'Desert Eagle', 'SIDEARM', 900],
    ['uzi', 'MP9', 'SMG', 1100],
    ['ump45', 'UMP-45', 'SMG', 1400],
    ['nova', 'Nova', 'SHOTGUN', 1600],
    ['xm1014', 'XM1014', 'SHOTGUN', 2400],
    ['famas', 'FAMAS', 'RIFLE', 2200],
    ['m4a1', 'M4A1-S', 'RIFLE', 3200],
    ['ak47', 'AK-47', 'RIFLE', 3000],
    ['scout', 'SSG 08', 'PRECISION', 2800],
    ['awp', 'AWP', 'PRECISION', 4200],
  ];

  assert.deepEqual(Object.keys(WEAPONS), expected.map(([id]) => id));
  for (const [id, name, category, unlockPrice] of expected) {
    const weapon = WEAPONS[id];
    assert.deepEqual(
      [weapon.id, weapon.name, weapon.category, weapon.unlockPrice, weapon.price],
      [id, name, category, unlockPrice, unlockPrice],
    );
    assert.match(weapon.description, /[\u3400-\u9fff]/u);
    assert.match(weapon.description, /[A-Za-z]/u);
    assert.deepEqual(Object.keys(weapon.display), [
      'power', 'rate', 'accuracy', 'control', 'capacity',
    ]);
    for (const value of Object.values(weapon.display)) {
      assert.equal(Number.isInteger(value), true);
      assert.ok(value >= 0 && value <= 100);
    }
    assert.ok(new Set(Object.values(weapon.display)).size > 1);
  }
});

test('new weapon combat tuning matches the approved literal parameters', () => {
  const expected = {
    usp: { damage: 18, headshotMult: 2, fireRate: 220, magazine: 12, reserveAmmo: 72, reloadTime: 1700, baseSpread: 0.004, moveSpread: 0.022, shotSpread: 0.008, maxSpread: 0.052, spreadRecovery: 0.12, recoilPitch: 0.38, recoilYaw: 0.002, recoilRecovery: 4.8, kick: 0.55, range: 22, auto: false },
    deagle: { damage: 46, headshotMult: 2, fireRate: 320, magazine: 7, reserveAmmo: 35, reloadTime: 2100, baseSpread: 0.006, moveSpread: 0.05, shotSpread: 0.018, maxSpread: 0.09, spreadRecovery: 0.095, recoilPitch: 0.9, recoilYaw: 0.004, recoilRecovery: 3.2, kick: 1.05, range: 24, auto: false },
    ump45: { damage: 17, headshotMult: 2, fireRate: 90, magazine: 25, reserveAmmo: 100, reloadTime: 2200, baseSpread: 0.01, moveSpread: 0.035, shotSpread: 0.009, maxSpread: 0.085, spreadRecovery: 0.115, recoilPitch: 0.4, recoilYaw: 0.0035, recoilRecovery: 4.4, kick: 0.62, range: 18, auto: true },
    nova: { damage: 9, headshotMult: 1.35, fireRate: 800, magazine: 8, reserveAmmo: 32, reloadTime: 2600, baseSpread: 0.012, moveSpread: 0.04, shotSpread: 0.015, maxSpread: 0.1, spreadRecovery: 0.1, recoilPitch: 0.9, recoilYaw: 0.003, recoilRecovery: 3.2, kick: 1.15, range: 12, auto: false, pellets: 8, pelletSpread: 0.085 },
    xm1014: { damage: 7, headshotMult: 1.25, fireRate: 240, magazine: 7, reserveAmmo: 28, reloadTime: 2800, baseSpread: 0.015, moveSpread: 0.05, shotSpread: 0.016, maxSpread: 0.12, spreadRecovery: 0.09, recoilPitch: 0.65, recoilYaw: 0.004, recoilRecovery: 3.6, kick: 0.9, range: 11, auto: false, pellets: 7, pelletSpread: 0.1 },
    famas: { damage: 22, headshotMult: 2, fireRate: 90, magazine: 25, reserveAmmo: 75, reloadTime: 2400, baseSpread: 0.008, moveSpread: 0.04, shotSpread: 0.01, maxSpread: 0.095, spreadRecovery: 0.11, recoilPitch: 0.48, recoilYaw: 0.0038, recoilRecovery: 4.1, kick: 0.75, range: 21, auto: true },
    m4a1: { damage: 24, headshotMult: 2, fireRate: 92, magazine: 25, reserveAmmo: 75, reloadTime: 2500, baseSpread: 0.006, moveSpread: 0.035, shotSpread: 0.009, maxSpread: 0.085, spreadRecovery: 0.115, recoilPitch: 0.44, recoilYaw: 0.0032, recoilRecovery: 4.3, kick: 0.72, range: 23, auto: true },
    scout: { damage: 68, headshotMult: 1.5, fireRate: 850, magazine: 10, reserveAmmo: 30, reloadTime: 2900, baseSpread: 0.0025, moveSpread: 0.08, shotSpread: 0.02, maxSpread: 0.12, spreadRecovery: 0.15, recoilPitch: 0.82, recoilYaw: 0.0025, recoilRecovery: 3.1, kick: 1.05, range: 30, auto: false },
  };

  for (const [id, fields] of Object.entries(expected)) {
    for (const [field, value] of Object.entries(fields)) {
      assert.equal(WEAPONS[id][field], value, `${id}.${field}`);
    }
  }
});

test('a fired pistol shot carries weapon damage', () => {
  const weapon = createWeapon('pistol');
  const enemy = { x: 3, y: 1.1, radius: 0.3, alive: true };
  const shot = tryFire(
    weapon,
    { x: 1, y: 1, angle: 0 },
    [enemy],
    openMap,
    1000,
    { random: () => 0.5 },
  );

  assert.equal(shot.fired, true);
  assert.equal(shot.hit.entity, enemy);
  assert.equal(shot.hit.damage, weapon.damage);
  assert.deepEqual(shot.hits, [shot.hit]);
});

test('a shotgun traces every pellet with injected randomness but advances once', () => {
  const weapon = createWeapon('nova');
  const enemy = { x: 3, y: 1.24, radius: 0.3, alive: true };
  let randomCalls = 0;

  const shot = tryFire(
    weapon,
    { x: 1, y: 1, angle: 0, movementIntensity: 0 },
    [enemy],
    openMap,
    1000,
    { random: () => { randomCalls++; return 1; } },
  );

  assert.equal(shot.fired, true);
  assert.equal(randomCalls, weapon.pellets);
  assert.equal(shot.hits.length, weapon.pellets);
  assert.equal(shot.hit, shot.hits[0]);
  for (const hit of shot.hits) {
    assert.equal(hit.entity, enemy);
    assert.equal(hit.damage, weapon.damage);
  }
  assert.equal(weapon.currentAmmo, weapon.magazine - 1);
  assert.equal(weapon.shotIndex, 1);

  const cooldown = tryFire(
    weapon,
    { x: 1, y: 1, angle: 0, movementIntensity: 0 },
    [enemy],
    openMap,
    1100,
    { random: () => { throw new Error('cooldown must not trace pellets'); } },
  );
  assert.deepEqual(
    { fired: cooldown.fired, reason: cooldown.reason, hit: cooldown.hit, hits: cooldown.hits },
    { fired: false, reason: 'cooldown', hit: null, hits: [] },
  );
  assert.equal(weapon.currentAmmo, weapon.magazine - 1);
  assert.equal(weapon.shotIndex, 1);
});

test('XM1014 maps seven deterministic samples to seven headshot pellet rays', () => {
  const weapon = createWeapon('xm1014');
  const randomValues = [0, 1, 0.15, 0.85, 0.3, 0.7, 0.5];
  const enemies = [2.884873, 3.115127, 2.919456, 3.080544, 2.953992, 3.046008, 3]
    .map((y, index) => ({ id: index, x: 3, y, radius: 0.012, alive: true }));
  let randomIndex = 0;

  const shot = tryFire(
    weapon,
    { x: 1, y: 3, angle: 0, cameraOffset: 20, movementIntensity: 0 },
    enemies,
    openMap,
    1000,
    { random: () => randomValues[randomIndex++] },
  );

  assert.equal(randomIndex, 7);
  assert.equal(shot.hits.length, 7);
  assert.deepEqual(shot.hits.map(hit => hit.entity.id), [0, 1, 2, 3, 4, 5, 6]);
  for (const hit of shot.hits) {
    assert.equal(hit.isHeadshot, true);
    assert.equal(hit.damage, 8.75);
  }
});

test('a fresh weapon can fire at clock time zero', () => {
  const weapon = createWeapon('pistol');
  const shot = tryFire(
    weapon,
    { x: 1, y: 1, angle: Math.PI, movementIntensity: 0 },
    [],
    openMap,
    0,
    { random: () => 0.5 },
  );

  assert.equal(shot.fired, true);
  assert.equal(shot.reason, null);
});

test('AWP can hit a target beyond the generic 20 unit distance', () => {
  const weapon = createWeapon('awp');
  const longMap = Array.from({ length: 5 }, (_, y) =>
    Array.from({ length: 32 }, (_, x) => (
      x === 0 || y === 0 || x === 31 || y === 4 ? 1 : 0
    )),
  );
  const enemy = { x: 26, y: 2, radius: 0.3, alive: true };

  const shot = tryFire(
    weapon,
    { x: 1, y: 2, angle: 0, movementIntensity: 0 },
    [enemy],
    longMap,
    0,
    { random: () => 0.5 },
  );

  assert.equal(shot.fired, true);
  assert.equal(shot.hit?.entity, enemy);
});

test('a centered crosshair hits the body instead of an automatic headshot', () => {
  const weapon = createWeapon('pistol');
  const enemy = { x: 3, y: 1, radius: 0.3, alive: true };

  const shot = tryFire(
    weapon,
    { x: 1, y: 1, angle: 0, cameraOffset: 0 },
    [enemy],
    openMap,
    1000,
    { random: () => 0.5 },
  );

  assert.equal(shot.hit.isHeadshot, false);
  assert.equal(shot.hit.damage, weapon.damage);
});

test('vertical aim aligned with the rendered head applies headshot damage', () => {
  const weapon = createWeapon('pistol');
  const enemy = { x: 3, y: 1, radius: 0.3, alive: true };

  const shot = tryFire(
    weapon,
    { x: 1, y: 1, angle: 0, cameraOffset: 20 },
    [enemy],
    openMap,
    1000,
    { random: () => 0.5 },
  );

  assert.equal(shot.hit.isHeadshot, true);
  assert.equal(shot.hit.damage, weapon.damage * weapon.headshotMult);
});

test('vertical aim outside the rendered sprite misses the target', () => {
  const weapon = createWeapon('awp');
  const longMap = Array.from({ length: 5 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => (
      x === 0 || y === 0 || x === 15 || y === 4 ? 1 : 0
    )),
  );
  const enemy = { x: 11, y: 2, radius: 0.3, alive: true };

  const shot = tryFire(
    weapon,
    { x: 1, y: 2, angle: 0, cameraOffset: 24 },
    [enemy],
    longMap,
    1000,
    { random: () => 0.5 },
  );

  assert.equal(shot.fired, true);
  assert.equal(shot.hit, null);
});

test('vertical aim through the visible gap between enemy legs misses', () => {
  const weapon = createWeapon('pistol');
  const enemy = { x: 3, y: 1, radius: 0.3, alive: true };

  const shot = tryFire(
    weapon,
    { x: 1, y: 1, angle: 0, cameraOffset: -17.6 },
    [enemy],
    openMap,
    1000,
    { random: () => 0.5 },
  );

  assert.equal(shot.fired, true);
  assert.equal(shot.hit, null);
});

test('horizontal aim outside the rendered body misses the target', () => {
  const weapon = createWeapon('pistol');
  const enemy = { x: 3, y: 1.29, radius: 0.3, alive: true };

  const shot = tryFire(
    weapon,
    { x: 1, y: 1, angle: 0, cameraOffset: 0 },
    [enemy],
    openMap,
    1000,
    { random: () => 0.5 },
  );

  assert.equal(shot.fired, true);
  assert.equal(shot.hit, null);
});

test('horizontal aim outside the rendered head does not award a headshot', () => {
  const weapon = createWeapon('pistol');
  const enemy = { x: 3, y: 1.15, radius: 0.3, alive: true };

  const shot = tryFire(
    weapon,
    { x: 1, y: 1, angle: 0, cameraOffset: 20 },
    [enemy],
    openMap,
    1000,
    { random: () => 0.5 },
  );

  assert.equal(shot.fired, true);
  assert.equal(shot.hit, null);
});

test('a wall blocks an otherwise valid entity hit', () => {
  const weapon = createWeapon('pistol');
  const enemy = { x: 5, y: 1, radius: 0.3, alive: true };
  const blockedMap = openMap.map(row => [...row]);
  blockedMap[1][3] = 1;

  const shot = tryFire(
    weapon,
    { x: 1, y: 1, angle: 0 },
    [enemy],
    blockedMap,
    1000,
    { random: () => 0.5 },
  );

  assert.equal(shot.fired, true);
  assert.equal(shot.hit, null);
});

test('a miss still returns a fired shot event', () => {
  const weapon = createWeapon('pistol');
  const shot = tryFire(
    weapon,
    { x: 1, y: 1, angle: Math.PI },
    [],
    openMap,
    1000,
    { random: () => 0.5 },
  );

  assert.equal(shot.fired, true);
  assert.equal(shot.hit, null);
  assert.deepEqual(shot.hits, []);
  assert.equal(weapon.currentAmmo, weapon.magazine - 1);
});

test('cooldown returns a non-fired result without consuming ammo', () => {
  const weapon = createWeapon('pistol');
  const player = { x: 1, y: 1, angle: 0 };

  tryFire(weapon, player, [], openMap, 1000, { random: () => 0.5 });
  const ammo = weapon.currentAmmo;
  const shot = tryFire(weapon, player, [], openMap, 1050, { random: () => 0.5 });

  assert.deepEqual(
    { fired: shot.fired, reason: shot.reason },
    { fired: false, reason: 'cooldown' },
  );
  assert.equal(weapon.currentAmmo, ammo);
});

test('movement and repeated fire increase spread up to the weapon cap', () => {
  const weapon = createWeapon('ak47');
  const player = { x: 1, y: 1, angle: Math.PI, movementIntensity: 1 };

  const first = tryFire(weapon, player, [], openMap, 1000, { random: () => 0.5 });
  const second = tryFire(weapon, player, [], openMap, 1100, { random: () => 0.5 });

  assert.ok(first.spread > weapon.baseSpread);
  assert.ok(second.spread > first.spread);
  assert.ok(second.spread <= weapon.maxSpread);
});

test('spread and recoil recover after the reset delay', () => {
  const weapon = createWeapon('ak47');
  tryFire(
    weapon,
    { x: 1, y: 1, angle: 0, movementIntensity: 0 },
    [],
    openMap,
    1000,
    { random: () => 0.5 },
  );
  const spreadAfterShot = weapon.currentSpread;
  const recoilAfterShot = weapon.recoilY;

  updateWeaponHandling(weapon, 0.5, 1600);

  assert.ok(weapon.currentSpread < spreadAfterShot);
  assert.ok(weapon.recoilY < recoilAfterShot);
  assert.equal(weapon.shotIndex, 0);
});

test('spread bloom does not recover during the short post-shot delay', () => {
  const weapon = createWeapon('ak47');
  tryFire(
    weapon,
    { x: 1, y: 1, angle: 0, movementIntensity: 0 },
    [],
    openMap,
    1000,
    { random: () => 0.5 },
  );
  const spreadAfterShot = weapon.currentSpread;

  updateWeaponHandling(weapon, 0.05, 1050);

  assert.equal(weapon.currentSpread, spreadAfterShot);
});

test('movement spread is transient and does not become stored bloom', () => {
  const weapon = createWeapon('ak47');
  const effective = getEffectiveSpread(weapon, 1);

  assert.ok(effective > weapon.currentSpread);
  tryFire(
    weapon,
    { x: 1, y: 1, angle: 0, movementIntensity: 1 },
    [],
    openMap,
    1000,
    { random: () => 0.5 },
  );

  assert.equal(weapon.currentSpread, weapon.baseSpread + weapon.shotSpread);
});

test('injected randomness makes a shot angle repeatable', () => {
  const firstWeapon = createWeapon('uzi');
  const secondWeapon = createWeapon('uzi');
  const player = { x: 1, y: 1, angle: 0.75, movementIntensity: 0 };

  const first = tryFire(firstWeapon, player, [], openMap, 1000, { random: () => 0.8 });
  const second = tryFire(secondWeapon, player, [], openMap, 1000, { random: () => 0.8 });

  assert.equal(first.rayAngle, second.rayAngle);
  assert.deepEqual(first.recoil, second.recoil);
});

test('player weapon recoil decays toward neutral', () => {
  const player = new Player(1, 1, 0);

  player.applyWeaponRecoil({ x: 0.02, y: 1, kick: 1 });
  const initialX = player.recoilX;
  const initialY = player.recoilY;
  player.updateWeaponHandling(0.25);

  assert.ok(Math.abs(player.recoilX) < Math.abs(initialX));
  assert.ok(player.recoilY < initialY);
  assert.ok(player.recoilY >= 0);
});

test('downward mouse movement counteracts upward visual recoil', () => {
  const player = new Player(1, 1, 0);
  player.applyWeaponRecoil({ x: 0, y: 1, kick: 1 });
  const kickedOffset = player.cameraOffset;

  player.applyLookDelta(0, 20);

  assert.ok(player.cameraOffset < kickedOffset);
});

test('A strafes left without requiring a forward key', () => {
  const player = new Player(3, 3, 0);
  const input = {
    consumeMouseX: () => 0,
    isHeld: code => code === 'KeyA',
  };

  player.move(0.1, input, openMap);

  assert.equal(player.x, 3);
  assert.ok(player.y < 3);
  assert.equal(player.movementIntensity, 1);
});

test('pushing into a wall does not count as movement for accuracy', () => {
  const player = new Player(1.2, 1.2, 0);
  const input = {
    consumeMouseX: () => 0,
    consumeMouseY: () => 0,
    isHeld: code => code === 'KeyA',
  };

  player.move(0.1, input, openMap);

  assert.equal(player.y, 1.2);
  assert.equal(player.movementIntensity, 0);
});
