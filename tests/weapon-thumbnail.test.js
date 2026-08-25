import test from 'node:test';
import assert from 'node:assert/strict';

import { renderWeaponThumbnail } from '../js/ui/weapon-thumbnail.js';
import { WEAPON_VISUALS } from '../js/ui/theme.js';

function createRecordingCanvas() {
  const calls = [];
  const ctx = {
    imageSmoothingEnabled: true,
    fillStyle: '',
    clearRect: (...args) => calls.push(['clearRect', ...args]),
    putImageData: (...args) => calls.push(['putImageData', ...args]),
    createImageData: (width, height) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    }),
  };
  return {
    canvas: { width: 120, height: 80, getContext: kind => (kind === '2d' ? ctx : null) },
    ctx,
    calls,
  };
}

test('renderWeaponThumbnail paints each catalog weapon with its native pixel size', () => {
  for (const id of Object.keys(WEAPON_VISUALS)) {
    const { canvas, ctx, calls } = createRecordingCanvas();
    renderWeaponThumbnail(canvas, id);
    const visual = WEAPON_VISUALS[id];

    assert.equal(ctx.imageSmoothingEnabled, false);
    assert.deepEqual(
      calls[0],
      ['clearRect', 0, 0, canvas.width, canvas.height],
      `${id} should clear the canvas before drawing`,
    );
    const putCall = calls.find(([op]) => op === 'putImageData');
    assert.ok(putCall, `${id} must call putImageData`);
    const imageData = putCall[1];
    assert.equal(imageData.width, visual.width, `${id} image width should match visual`);
    assert.equal(imageData.height, visual.height, `${id} image height should match visual`);
    assert.equal(imageData.data.length, visual.width * visual.height * 4);
  }
});

test('renderWeaponThumbnail centers the weapon image inside a larger canvas', () => {
  const { canvas, calls } = createRecordingCanvas();
  canvas.width = 160;
  canvas.height = 96;
  const id = 'awp';
  const visual = WEAPON_VISUALS[id];

  renderWeaponThumbnail(canvas, id);

  const putCall = calls.find(([op]) => op === 'putImageData');
  const offsetX = putCall[2];
  const offsetY = putCall[3];
  assert.equal(offsetX, Math.floor((canvas.width - visual.width) / 2));
  assert.equal(offsetY, Math.floor((canvas.height - visual.height) / 2));
});

test('renderWeaponThumbnail fills at least one opaque pixel for every weapon', () => {
  for (const id of Object.keys(WEAPON_VISUALS)) {
    const { canvas, calls } = createRecordingCanvas();
    renderWeaponThumbnail(canvas, id);
    const imageData = calls.find(([op]) => op === 'putImageData')[1];
    let opaquePixels = 0;
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] > 0) opaquePixels++;
    }
    assert.ok(opaquePixels > 20, `${id} should have visible pixels (got ${opaquePixels})`);
  }
});

test('renderWeaponThumbnail tolerates unknown weapon ids without throwing', () => {
  const { canvas, calls } = createRecordingCanvas();
  assert.doesNotThrow(() => renderWeaponThumbnail(canvas, 'ghost-cannon'));
  assert.ok(calls.some(([op]) => op === 'putImageData'));
});

test('renderWeaponThumbnail tolerates unavailable canvas context', () => {
  assert.doesNotThrow(() => renderWeaponThumbnail(null, 'pistol'));
  assert.doesNotThrow(() => renderWeaponThumbnail({ getContext: () => null }, 'pistol'));
});
