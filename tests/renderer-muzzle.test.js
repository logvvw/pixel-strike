import test from 'node:test';
import assert from 'node:assert/strict';

import { WEAPON_VISUALS } from '../js/ui/theme.js';
import { Renderer } from '../js/engine/renderer.js';

test('every weapon visual exposes a normalized muzzle anchor above the screen midpoint', () => {
  for (const visual of Object.values(WEAPON_VISUALS)) {
    assert.ok(visual.muzzle, 'muzzle anchor is required');
    assert.ok(Number.isFinite(visual.muzzle.x));
    assert.ok(Number.isFinite(visual.muzzle.y));
    assert.ok(visual.muzzle.x >= 0 && visual.muzzle.x <= 1);
    // Muzzle must sit on the upper half of the sprite (closer to the barrel
    // tip, not the grip). Anything above 0.5 would land near the optical
    // sights; 0.32-0.36 mirrors the slide tip across the catalog.
    assert.ok(visual.muzzle.y > 0 && visual.muzzle.y < 0.5,
      `muzzle Y=${visual.muzzle.y} should sit on the upper half of the sprite`);
  }
});

test('renderer anchors the muzzle flash to the weapon visual, never below the crosshair', () => {
  const fakeCanvas = createFakeCanvas();
  const renderer = new Renderer(fakeCanvas);
  const player = {
    angle: 0,
    cameraOffset: 0,
    weaponBob: 0,
    currentWeapon: { id: 'pistol', reloading: false, reloadEnd: 0, reloadTime: 1 },
  };
  for (const id of Object.keys(WEAPON_VISUALS)) {
    player.currentWeapon.id = id;
    const frame = renderer.getWeaponFrame(id, 0, 0, 0);
    const muzzle = renderer.getMuzzleAnchor(frame);
    assert.ok(muzzle.y <= 100,
      `${id} muzzle Y=${muzzle.y} should sit at or above the crosshair (Y=100)`);
  }
});

function createFakeCanvas() {
  const imageData = {
    data: new Uint8ClampedArray(320 * 200 * 4),
    width: 320,
    height: 200,
  };
  return {
    width: 320,
    height: 200,
    getContext: () => ({
      createImageData: () => imageData,
      putImageData: () => {},
    }),
  };
}
