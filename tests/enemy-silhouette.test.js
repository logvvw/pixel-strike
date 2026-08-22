import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getEnemyPart,
  isEnemyHeadPart,
} from '../js/engine/enemy-silhouette.js';
import { PALETTE } from '../js/ui/theme.js';

test('LEGO silhouette exposes head, torso, arm, hand, hip, leg, and boot regions', () => {
  // Head
  assert.equal(getEnemyPart(0.5, 0.05), 'helmet');
  assert.equal(getEnemyPart(0.5, 0.21), 'face');
  assert.equal(getEnemyPart(0.5, 0.165), 'eye');

  // Neck / torso
  assert.equal(getEnemyPart(0.5, 0.26), 'neck');
  assert.equal(getEnemyPart(0.5, 0.32), 'vest');
  assert.equal(getEnemyPart(0.5, 0.41), 'webbing');

  // Arms and claw hands
  assert.equal(getEnemyPart(0.10, 0.42), 'arm');
  assert.equal(getEnemyPart(0.90, 0.42), 'arm');
  assert.equal(getEnemyPart(0.10, 0.52), 'hand');
  assert.equal(getEnemyPart(0.90, 0.52), 'hand');

  // Waist block
  assert.equal(getEnemyPart(0.5, 0.62), 'hips');

  // Legs and boots
  assert.equal(getEnemyPart(0.34, 0.78), 'legs');
  assert.equal(getEnemyPart(0.64, 0.78), 'legs');
  assert.equal(getEnemyPart(0.36, 0.95), 'boots');
  assert.equal(getEnemyPart(0.66, 0.95), 'boots');
});

test('LEGO silhouette never exposes a fragmented/unused part', () => {
  const representative = [
    [0.5, 0.05], [0.5, 0.16], [0.5, 0.26], [0.5, 0.32],
    [0.10, 0.42], [0.90, 0.42], [0.10, 0.52], [0.90, 0.52],
    [0.5, 0.62], [0.34, 0.78], [0.64, 0.78], [0.36, 0.95],
  ];
  const allParts = representative.map(([x, y]) => getEnemyPart(x, y));
  assert.ok(allParts.every(part => part !== null), 'every LEGO body region must resolve to a part');
});

test('only helmet, face, and eye register as headshot parts', () => {
  const headParts = ['helmet', 'face', 'eye'];
  const nonHeadParts = ['uniform', 'neck', 'vest', 'webbing', 'arm', 'hand', 'hips', 'legs', 'boots', 'weapon'];
  for (const part of headParts) assert.equal(isEnemyHeadPart(part), true);
  for (const part of nonHeadParts) assert.equal(isEnemyHeadPart(part), false);
});

test('theme exposes the LEGO palette colors used by the enemy silhouette', () => {
  assert.equal(PALETTE.LEGO_YELLOW, '#F2CD37');
  assert.equal(PALETTE.LEGO_BROWN, '#5A3A1A');
  assert.equal(PALETTE.LEGO_BLUE, '#0D6BC8');
});
