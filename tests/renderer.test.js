import test from 'node:test';
import assert from 'node:assert/strict';

import { Renderer, shadeRgb } from '../js/engine/renderer.js';

const WEAPON_IDS = [
  'pistol', 'usp', 'deagle', 'uzi', 'ump45', 'nova',
  'xm1014', 'famas', 'm4a1', 'ak47', 'scout', 'awp',
];

function createRenderer() {
  const context = createContext2d();
  return new Renderer({ getContext: () => context });
}

test('objective tiles 5 and 6 do not render as solid walls', () => {
  const renderer = createRenderer();
  const map = [
    [1, 1, 1, 1, 1, 1],
    [1, 0, 5, 6, 0, 1],
    [1, 1, 1, 1, 1, 1],
  ];

  const hit = renderer.castRay(1.5, 1.5, 0, map);

  assert.equal(hit.tile, 1);
  assert.ok(hit.dist > 3);
});

test('castRay exposes a stable wall coordinate for texture sampling', () => {
  const renderer = createRenderer();
  const map = [
    [1, 1, 1, 1],
    [1, 0, 0, 1],
    [1, 1, 1, 1],
  ];

  const hit = renderer.castRay(1.5, 1.5, 0, map);

  assert.equal(hit.tile, 1);
  assert.ok(hit.wallX >= 0 && hit.wallX < 1);
  assert.equal(hit.wallX, 0.5);
});

test('wall texture coordinate remains world-anchored across a small turn', () => {
  const renderer = createRenderer();
  const map = [
    [1, 1, 1, 1],
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [1, 1, 1, 1],
  ];

  const straight = renderer.castRay(1.5, 1.5, 0, map);
  const turned = renderer.castRay(1.5, 1.5, 0.01, map);

  assert.ok(Math.abs(straight.wallX - turned.wallX) < 0.03);
});

test('wall shading darkens side faces and fogs distant samples toward gunmetal', () => {
  const front = shadeRgb([120, 110, 100], 0, 1);
  const side = shadeRgb([120, 110, 100], 1, 1);
  const distant = shadeRgb([120, 110, 100], 0, 20);

  assert.ok(side[0] < front[0] && side[1] < front[1] && side[2] < front[2]);
  assert.deepEqual(distant, [60, 66, 57]);
});

test('sprite occlusion compares forward depth against the wall z-buffer', () => {
  const renderer = createRenderer();
  renderer.zBuffer.fill(3.5);
  const angle = Math.PI / 180 * 25;
  const entity = {
    type: 'enemy',
    x: 3.3,
    y: Math.tan(angle) * 3.3,
    visible: true,
    hitFlash: 0,
  };

  renderer.drawSprites({ x: 0, y: 0, angle: 0 }, [entity], 100);

  assert.ok(renderer.pixels.some((value, index) => index % 4 === 3 && value === 255));
});

test('front-facing LEGO enemy renders yellow hands, blue legs, and brown boots', () => {
  const renderer = createRenderer();
  renderer.zBuffer.fill(20);
  const entity = {
    type: 'enemy',
    x: 3,
    y: 0,
    visible: true,
    hitFlash: 0,
  };

  renderer.drawSprites({ x: 0, y: 0, angle: 0 }, [entity], 100);

  let yellow = 0;
  let blue = 0;
  let brown = 0;
  for (let index = 0; index < renderer.pixels.length; index += 4) {
    const r = renderer.pixels[index];
    const g = renderer.pixels[index + 1];
    const b = renderer.pixels[index + 2];
    if (r > 180 && g > 120 && b < 110) yellow++;
    if (r < 80 && g < 140 && b > 110) blue++;
    if (r > 60 && r < 130 && g > 25 && g < 90 && b < 50) brown++;
  }

  assert.ok(yellow > 0, 'LEGO yellow hands/face must render');
  assert.ok(blue > 0, 'LEGO blue legs must render');
  assert.ok(brown > 0, 'LEGO brown boots must render');
});

test('first-person weapon frames are distinct and stay inside the viewport', () => {
  const renderer = createRenderer();
  const frames = WEAPON_IDS
    .map(id => renderer.getWeaponFrame(id, 0, 0, 0));

  assert.equal(
    new Set(frames.map(frame => `${frame.x},${frame.y},${frame.width},${frame.height}`)).size,
    WEAPON_IDS.length,
  );
  for (const frame of frames) {
    assert.ok(frame.x >= 0 && frame.y >= 0);
    assert.ok(frame.x + frame.width <= 320);
    assert.ok(frame.y + frame.height <= 200);
  }
});

test('weapon kick moves the frame down without changing its silhouette', () => {
  const renderer = createRenderer();
  const calm = renderer.getWeaponFrame('ak47', 0, 0, 0);
  const kicked = renderer.getWeaponFrame('ak47', 0, 0, 1);

  assert.equal(kicked.width, calm.width);
  assert.equal(kicked.height, calm.height);
  assert.ok(kicked.y > calm.y);
});

test('first-person weapons use a right-handed stance', () => {
  const renderer = createRenderer();
  for (const id of WEAPON_IDS) {
    const frame = renderer.getWeaponFrame(id, 0, 0, 0);
    assert.ok(frame.x + frame.width / 2 > 160);
  }
});

test('every catalog weapon draws its configured first-person silhouette', () => {
  const signatures = new Set();

  for (const id of WEAPON_IDS) {
    const renderer = createRenderer();
    const frame = renderer.getWeaponFrame(id, 0, 0, 0);
    renderer.drawWeapon({ currentWeapon: { id, reloading: false }, weaponBob: 0 });

    let painted = 0;
    const rows = [];
    for (let index = 0; index < renderer.pixels.length; index += 4) {
      if (renderer.pixels[index + 3] === 255) {
        painted++;
        rows.push(Math.floor((index / 4) / 320));
      }
    }

    const signature = `${id}:painted=${painted}:rows=${Math.min(...rows)}-${Math.max(...rows)}:frame=${frame.x},${frame.y},${frame.width},${frame.height}`;
    signatures.add(signature);
  }

  assert.equal(signatures.size, WEAPON_IDS.length);
});

test('representative category silhouettes expose distinct functional proportions', () => {
  const renderer = createRenderer();
  const representatives = ['famas', 'ump45', 'nova', 'scout'];
  const proportions = representatives.map(id => {
    const frame = renderer.getWeaponFrame(id, 0, 0, 0);
    return `${id}:${frame.width}x${frame.height}`;
  });
  assert.equal(new Set(proportions).size, representatives.length);
});

test('representative categories render glove pixels at distinct hand anchors', () => {
  const renderer = createRenderer();
  const representatives = ['usp', 'ump45', 'nova', 'famas', 'scout'];
  const gloveSignatures = representatives.map(id => {
    renderer.drawWeapon({ currentWeapon: { id, reloading: false }, weaponBob: 0 });
    let glove = 0;
    let top = Infinity;
    for (let index = 0; index < renderer.pixels.length; index += 4) {
      const r = renderer.pixels[index];
      const g = renderer.pixels[index + 1];
      const b = renderer.pixels[index + 2];
      // Glove hue is OLIVE (#59604A): rgb(89,96,74) with fog/lighting variance.
      if (r >= 70 && r <= 105 && g >= 75 && g <= 110 && b >= 55 && b <= 85) {
        glove++;
        top = Math.min(top, Math.floor((index / 4) / 320));
      }
    }
    return `${id}:glove=${glove}:top=${top}`;
  });
  assert.equal(new Set(gloveSignatures).size, representatives.length);
});

test('pistol silhouette includes a readable hollow trigger guard', () => {
  const renderer = createRenderer();
  renderer.drawWeapon({ currentWeapon: { id: 'pistol', reloading: false }, weaponBob: 0 });
  const frame = renderer.getWeaponFrame('pistol', 0, 0, 0);
  // The trigger guard is a hollow region inside the frame. Sample a set of
  // pixels that should be filled by the guard ring (body color) and a set
  // that should be empty (transparent) to prove it is a hollow outline.
  const bodyPixels = [
    [frame.x + 17, frame.y + 28],  // left guard wall (gx16-18, gy27-36)
    [frame.x + 28, frame.y + 35],  // bottom guard bar (gx27-29, gy34-36)
  ];
  const holePixels = [
    [frame.x + 22, frame.y + 30],  // interior of the hollow guard
    [frame.x + 25, frame.y + 32],
  ];
  for (const [x, y] of bodyPixels) {
    const index = (y * 320 + x) * 4;
    assert.equal(renderer.pixels[index + 3], 255, `expected painted trigger guard outline at ${x},${y}`);
  }
  for (const [x, y] of holePixels) {
    const index = (y * 320 + x) * 4;
    assert.equal(renderer.pixels[index + 3], 0, `expected hollow trigger guard at ${x},${y}`);
  }
});

function createContext2d() {
  return {
    createImageData: (width, height) => ({
      data: new Uint8ClampedArray(width * height * 4),
    }),
    putImageData: () => {},
  };
}
