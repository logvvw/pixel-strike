import test from 'node:test';
import assert from 'node:assert/strict';

import { Player } from '../js/engine/player.js';

function createHarness() {
  const player = new Player(2, 2, 0);
  const input = {
    consumeMouseX: () => 0,
    consumeMouseY: () => 0,
    isHeld: () => false,
  };
  return { player, input };
}

// A single open cell.
const openCell = [
  [1, 1, 1],
  [1, 0, 1],
  [1, 1, 1],
];

// A long open corridor along +X so movement is never blocked.
const corridor = [
  [1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1],
];

// Wall at x=0, passable floor at x=1..2 in the centre row.
const wallAtEdge = [
  [1, 1, 1],
  [1, 0, 0],
  [1, 1, 1],
];

test('crouching lowers the camera offset (eye line drops)', () => {
  const { player, input } = createHarness();
  const standingOffset = player.cameraOffset;
  input.isHeld = code => code === 'ShiftLeft';
  player.move(0.016, input, openCell);
  assert.equal(player.crouching, true);
  assert.ok(player.cameraOffset > standingOffset, 'crouch must drop the view');
});

test('crouching slows movement relative to standing', () => {
  const standing = new Player(1.5, 1.5, 0);
  const standingInput = {
    consumeMouseX: () => 0,
    consumeMouseY: () => 0,
    isHeld: code => code === 'KeyW',
  };
  const standingStart = standing.x;
  for (let i = 0; i < 30; i++) standing.move(0.02, standingInput, corridor);
  const standingDistance = Math.abs(standing.x - standingStart);

  const crouched = new Player(1.5, 1.5, 0);
  const crouchedInput = {
    consumeMouseX: () => 0,
    consumeMouseY: () => 0,
    isHeld: code => code === 'KeyW' || code === 'ShiftLeft' || code === 'ShiftRight',
  };
  const crouchedStart = crouched.x;
  for (let i = 0; i < 30; i++) crouched.move(0.02, crouchedInput, corridor);
  const crouchedDistance = Math.abs(crouched.x - crouchedStart);

  assert.ok(crouchedDistance < standingDistance, 'crouching should reduce distance traveled');
});

test('jump raises the camera then settles back to ground', () => {
  const { player, input } = createHarness();
  assert.equal(player.jump(), true);
  assert.equal(player.jumpActive, true);

  // Advance to roughly the middle of the jump arc.
  for (let i = 0; i < 9; i++) player.move(0.02, input, openCell);
  assert.ok(player.cameraOffset < 0, 'mid-jump eye line should lift above baseline');

  // Advance past the full jump duration.
  for (let i = 0; i < 30; i++) player.move(0.02, input, openCell);

  assert.equal(player.jumpActive, false);
  assert.equal(player.cameraOffset, 0);
});

test('a second jump is rejected while airborne', () => {
  const { player } = createHarness();
  assert.equal(player.jump(), true);
  assert.equal(player.jump(), false);
});

test('crouch uses a smaller collision radius', () => {
  const standing = new Player(1.15, 1.5, 0);
  standing.crouching = false;
  const crouched = new Player(1.15, 1.5, 0);
  crouched.crouching = true;

  // Center x=1.15 next to the wall at x=0. Standing radius 0.2 probes to
  // x=0.95 (wall) so it collides. Crouched radius 0.14 probes to x=1.01
  // (passable floor) and, with y centered at 1.5, stays inside the open row.
  assert.equal(standing.collidesWithWall(1.15, 1.5, wallAtEdge), true);
  assert.equal(crouched.collidesWithWall(1.15, 1.5, wallAtEdge), false);
});
