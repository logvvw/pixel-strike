import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MATERIALS,
  PALETTE,
  UI_COPY,
  WEAPON_VISUALS,
  hexToRgb,
  sampleMaterial,
} from '../js/ui/theme.js';

test('theme exposes the approved tactical palette and plain UI copy', () => {
  assert.equal(PALETTE.UI_AMBER, '#E3B341');
  assert.equal(PALETTE.DANGER, '#C65343');
  assert.deepEqual(hexToRgb('#11130F'), [17, 19, 15]);
  assert.equal(/[\p{Extended_Pictographic}]/u.test(Object.values(UI_COPY).join(' ')), false);
});

test('solid map tiles sample deterministic wrapping material texels', () => {
  for (const tile of [1, 2, 3, 4]) {
    assert.ok(MATERIALS[tile]);
    assert.deepEqual(sampleMaterial(tile, 7, 11), sampleMaterial(tile, 23, 27));
    assert.equal(sampleMaterial(tile, 7, 11).length, 3);
  }
});

test('concrete texture detail stays subtle enough to preserve target readability', () => {
  const plain = sampleMaterial(1, 1, 1);
  const detail = sampleMaterial(1, 0, 0);
  const contrast = detail.reduce((sum, channel, index) => sum + Math.abs(channel - plain[index]), 0);

  assert.ok(contrast > 0);
  assert.ok(contrast <= 50);
});

test('every catalog weapon has a dedicated visual configuration', () => {
  const ids = [
    'pistol', 'usp', 'deagle', 'uzi', 'ump45', 'nova',
    'xm1014', 'famas', 'm4a1', 'ak47', 'scout', 'awp',
  ];

  assert.deepEqual(Object.keys(WEAPON_VISUALS), ids);
  assert.equal(new Set(Object.values(WEAPON_VISUALS)).size, ids.length);
  for (const visual of Object.values(WEAPON_VISUALS)) {
    assert.ok(visual.width > 0 && visual.height > 0);
    assert.ok(Number.isFinite(visual.stanceX));
  }
});

test('weapon visuals define distinct normalized hand anchors by category', () => {
  const representatives = ['usp', 'ump45', 'nova', 'famas', 'scout'];
  const signatures = representatives.map(id => {
    const hands = WEAPON_VISUALS[id].hands;
    assert.ok(hands);
    for (const hand of [hands.support, hands.grip]) {
      assert.deepEqual(Object.keys(hand), ['x0', 'x1', 'y0', 'cuffY']);
      assert.ok(hand.x0 >= 0 && hand.x0 < hand.x1 && hand.x1 <= 1);
      assert.ok(hand.y0 >= 0 && hand.y0 < hand.cuffY && hand.cuffY <= 1);
    }
    return JSON.stringify(hands);
  });

  assert.equal(new Set(signatures).size, representatives.length);
});
