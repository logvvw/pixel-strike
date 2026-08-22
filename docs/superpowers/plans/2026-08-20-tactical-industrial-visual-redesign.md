# PixStrike Tactical Industrial Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild PixStrike's presentation as a coherent 1990s tactical-industrial pixel FPS while preserving the existing single-map game loop and gunplay behavior.

**Architecture:** Add one dependency-free theme module as the source of truth for colors, materials, weapon silhouettes, and interface copy. Keep all 320×200 world drawing in `Renderer`, keep DOM state updates in `HUD`, and use semantic HTML plus CSS for the surrounding interface. Procedural textures and sprites are deterministic and generated at runtime, so no external assets or new dependencies are required.

**Tech Stack:** Browser ES modules, Canvas 2D pixel buffer, semantic HTML, CSS, Node.js built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-20-tactical-industrial-visual-redesign.md`

## Global Constraints

- Preserve the 320×200 internal resolution and nearest-neighbor CSS scaling.
- Preserve current weapon damage, spread, recoil, cadence, economy, movement, enemy AI, and round rules.
- Add no external images, fonts, packages, WebGL, maps, or game modes.
- Use this exact palette: INK `#11130F`, COAL `#232721`, GUNMETAL `#3C4239`, CONCRETE `#777468`, SAND `#A69A7B`, DUST `#C2B28C`, OLIVE `#59604A`, RUST `#8A4F36`, UI_AMBER `#E3B341`, IVORY `#DDD8C4`, MUTED `#858778`, SAFE `#87A36F`, DANGER `#C65343`.
- Keep material textures world-anchored, deterministic, and limited to 16×16 texels.
- Remove emoji and presentation-only inline styles from game UI copy and markup.
- Current directory is not a Git repository; replace commit steps with named verification checkpoints and do not initialize Git.

---

### Task 1: Theme contract and deterministic material sampler

**Files:**
- Create: `js/ui/theme.js`
- Create: `tests/theme.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: integer map tile IDs `1` through `4`, normalized texture coordinates, weapon IDs `pistol`, `uzi`, `ak47`, `awp`.
- Produces: `PALETTE`, `MATERIALS`, `WEAPON_VISUALS`, `UI_COPY`, `hexToRgb(hex)`, and `sampleMaterial(tile, texX, texY)`.

- [ ] **Step 1: Write the failing theme tests**

```js
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

test('all solid map tiles have deterministic 16 by 16 material samples', () => {
  for (const tile of [1, 2, 3, 4]) {
    assert.ok(MATERIALS[tile]);
    assert.deepEqual(sampleMaterial(tile, 7, 11), sampleMaterial(tile, 23, 27));
    assert.equal(sampleMaterial(tile, 7, 11).length, 3);
  }
});

test('each weapon has a distinct visual profile', () => {
  assert.deepEqual(Object.keys(WEAPON_VISUALS).sort(), ['ak47', 'awp', 'pistol', 'uzi']);
  assert.equal(new Set(Object.values(WEAPON_VISUALS).map(v => `${v.width}x${v.height}`)).size, 4);
});
```

- [ ] **Step 2: Run the focused tests and verify the missing-module failure**

Run: `node --test tests/theme.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `js/ui/theme.js`.

- [ ] **Step 3: Implement the theme module**

```js
export const PALETTE = Object.freeze({
  INK: '#11130F', COAL: '#232721', GUNMETAL: '#3C4239',
  CONCRETE: '#777468', SAND: '#A69A7B', DUST: '#C2B28C',
  OLIVE: '#59604A', RUST: '#8A4F36', UI_AMBER: '#E3B341',
  IVORY: '#DDD8C4', MUTED: '#858778', SAFE: '#87A36F',
  DANGER: '#C65343',
});

export function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export const MATERIALS = Object.freeze({
  1: { name: 'CONCRETE', base: PALETTE.CONCRETE, accent: PALETTE.DUST },
  2: { name: 'WOOD', base: PALETTE.SAND, accent: PALETTE.RUST },
  3: { name: 'BRICK', base: PALETTE.RUST, accent: PALETTE.INK },
  4: { name: 'METAL', base: PALETTE.GUNMETAL, accent: PALETTE.OLIVE },
});

export function sampleMaterial(tile, texX, texY) {
  const material = MATERIALS[tile] ?? MATERIALS[1];
  const x = ((Math.floor(texX) % 16) + 16) % 16;
  const y = ((Math.floor(texY) % 16) + 16) % 16;
  const base = hexToRgb(material.base);
  const accent = hexToRgb(material.accent);
  const pattern = tile === 1 ? ((x * 5 + y * 3) % 13 === 0)
    : tile === 2 ? (x % 7 === 0)
      : tile === 3 ? (y % 5 === 0 || (x + (Math.floor(y / 5) % 2) * 8) % 16 === 0)
        : (x === 1 || x === 14 || y === 1 || y === 14 || ((x === 4 || x === 11) && (y === 4 || y === 11)));
  return pattern ? accent : base;
}
```

Define `WEAPON_VISUALS` with unique `width`, `height`, `body`, `metal`, `grip`, and `accent` values for all four weapon IDs. Define `UI_COPY` with plain-text values for `mission`, `sector`, `start`, `buyTitle`, `buyClose`, `health`, `ammo`, `credits`, `headshot`, and `eliminated`.

- [ ] **Step 4: Run focused and full tests**

Run: `node --test tests/theme.test.js`

Expected: 3 tests PASS.

Run: `npm test`

Expected: all existing and new tests PASS.

- [ ] **Step 5: Record verification checkpoint**

Record in the task handoff: `theme-contract-green` with the focused and full test counts.

---

### Task 2: World-anchored walls, sky, ground, and distance fog

**Files:**
- Modify: `js/engine/renderer.js`
- Modify: `tests/renderer.test.js`

**Interfaces:**
- Consumes: `sampleMaterial(tile, texX, texY)` and `PALETTE` from `js/ui/theme.js`.
- Produces: `castRay()` results extended with `{ wallX: number }`, and `shadeRgb(rgb, side, distance)` returning an RGB tuple.

- [ ] **Step 1: Add failing renderer contract tests**

```js
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

test('wall material stays anchored when view angle changes', () => {
  const renderer = createRenderer();
  const map = [
    [1, 1, 1, 1],
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [1, 1, 1, 1],
  ];
  const a = renderer.castRay(1.5, 1.5, 0, map);
  const b = renderer.castRay(1.5, 1.5, 0.01, map);
  assert.ok(Math.abs(a.wallX - b.wallX) < 0.03);
});
```

- [ ] **Step 2: Verify the new tests fail**

Run: `node --test tests/renderer.test.js`

Expected: FAIL because `wallX` is undefined.

- [ ] **Step 3: Extend DDA ray results and render anchored wall samples**

In `castRay`, derive the hit coordinate after DDA completion:

```js
const hitWorld = side === 0 ? oy + dist * dirY : ox + dist * dirX;
let wallX = hitWorld - Math.floor(hitWorld);
if ((side === 0 && dirX > 0) || (side === 1 && dirY < 0)) wallX = 1 - wallX;
return { dist, tile, side, wallX };
```

In the wall loop, replace flat `WALL_COLORS` with a vertical material sample and fog-shading call:

```js
const texX = Math.floor(wallX * 16);
const texY = Math.floor(((row - drawStart) / Math.max(1, lineHeight)) * 16);
const [r, g, b] = shadeRgb(sampleMaterial(tile, texX, texY), side, perpDist);
```

Use `PALETTE` RGB values to draw a two-band olive-gray sky with sparse deterministic dither, a sand-gray floor with scanline dither, and distance fog that interpolates toward `GUNMETAL` without erasing texture contrast.

- [ ] **Step 4: Run renderer and full regression tests**

Run: `node --test tests/renderer.test.js`

Expected: all renderer tests PASS, including objective tiles `5` and `6` remaining non-solid.

Run: `npm test`

Expected: all tests PASS and no game-logic test count decreases.

- [ ] **Step 5: Record verification checkpoint**

Record: `world-materials-green`, including renderer and full test counts.

---

### Task 3: Tactical enemy sprite and weapon-specific first-person silhouettes

**Files:**
- Modify: `js/engine/renderer.js`
- Modify: `tests/renderer.test.js`

**Interfaces:**
- Consumes: `WEAPON_VISUALS`, player `currentWeapon.id`, `weaponBob`, `weaponKick`, feedback `muzzleFlash`, entity `health`, `maxHealth`, `hitFlash`, and `state`.
- Produces: `getWeaponFrame(id, bobX, bobY, kick)` returning a deterministic frame descriptor, `drawEnemySprite(...)`, and `drawWeapon(...)` with per-weapon geometry.

- [ ] **Step 1: Add failing silhouette tests**

```js
test('first-person weapon frames are distinct and stay inside the viewport', () => {
  const renderer = createRenderer();
  const frames = ['pistol', 'uzi', 'ak47', 'awp'].map(id => renderer.getWeaponFrame(id, 0, 0, 0));
  assert.equal(new Set(frames.map(frame => `${frame.x},${frame.y},${frame.width},${frame.height}`)).size, 4);
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
```

- [ ] **Step 2: Verify silhouette tests fail**

Run: `node --test tests/renderer.test.js`

Expected: FAIL because `getWeaponFrame` does not exist.

- [ ] **Step 3: Implement tactical sprite and weapon renderers**

Add `getWeaponFrame` using the profile sizes and centered bottom anchoring:

```js
getWeaponFrame(id, bobX = 0, bobY = 0, kick = 0) {
  const visual = WEAPON_VISUALS[id] ?? WEAPON_VISUALS.pistol;
  const x = Math.round((W - visual.width) / 2 + bobX);
  const y = Math.round(H - visual.height + Math.abs(bobY) + kick * 4);
  return { id, x, y, width: visual.width, height: visual.height, visual };
}
```

Replace the generic gray weapon block with profile-specific silhouettes:

- Glock: compact rectangular slide, short barrel, angled dark grip.
- MP9: box receiver, vertical grip, top rail, compact stock.
- AK-47: long gunmetal barrel, olive receiver, rust wood handguard and stock.
- AWP: long narrow barrel, raised optic, olive body, dark skeletal stock.
- All profiles share muted glove cuffs and blocky hands, while muzzle flash remains tied to the barrel endpoint.

Replace the abstract enemy block with an occlusion-safe tactical figure: dark boots and legs, olive vest torso, gunmetal weapon arm, sand balaclava face, dark helmet, two-pixel eye line. Preserve the current head/body/legs screen-space hitbox proportions and use `hitFlash` only as a brief ivory overlay.

- [ ] **Step 4: Run tests and static syntax checks**

Run: `node --test tests/renderer.test.js`

Expected: all renderer tests PASS.

Run: `find js -name '*.js' -print0 | xargs -0 -n1 node --check`

Expected: every JavaScript file exits successfully with no output.

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 5: Record verification checkpoint**

Record: `combat-silhouettes-green`, including tests and syntax status.

---

### Task 4: Semantic tactical HUD, mission boot screen, and equipment menu

**Files:**
- Modify: `index.html`
- Modify: `css/style.css`
- Modify: `js/ui/hud.js`
- Create: `tests/hud.test.js`

**Interfaces:**
- Consumes: `UI_COPY`, player health/ammo/money/score, round wave/time, feedback crosshair and marker state.
- Produces: plain-text tactical labels, class-driven health states, semantic equipment rows, and overlay content without inline styles.

- [ ] **Step 1: Add failing HUD helper tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import { getHealthState, getEquipmentRows, getOverlayModel } from '../js/ui/hud.js';

test('health state uses stable tactical status names', () => {
  assert.equal(getHealthState(100), 'nominal');
  assert.equal(getHealthState(45), 'warning');
  assert.equal(getHealthState(15), 'critical');
});

test('equipment rows contain no emoji or inline presentation data', () => {
  const rows = getEquipmentRows({ money: 3000, weapons: [{ id: 'pistol' }] });
  assert.equal(rows.length, 4);
  assert.equal(/[\p{Extended_Pictographic}]/u.test(JSON.stringify(rows)), false);
  assert.equal(rows.find(row => row.id === 'ak47').affordable, true);
});

test('overlay model is plain text and callback-safe', () => {
  const model = getOverlayModel('任务失败', '得分 100', '重新部署');
  assert.deepEqual(model, { title: '任务失败', subtitle: '得分 100', buttonText: '重新部署' });
});
```

- [ ] **Step 2: Verify helper tests fail**

Run: `node --test tests/hud.test.js`

Expected: FAIL because the helper exports do not exist.

- [ ] **Step 3: Implement testable HUD view models**

```js
export function getHealthState(percent) {
  if (percent <= 20) return 'critical';
  if (percent <= 60) return 'warning';
  return 'nominal';
}

export function getEquipmentRows(player) {
  return [
    { id: 'pistol', name: 'GLOCK-18', category: 'SIDEARM', price: 0 },
    { id: 'uzi', name: 'MP9', category: 'SMG', price: 1250 },
    { id: 'ak47', name: 'AK-47', category: 'RIFLE', price: 2700 },
    { id: 'awp', name: 'AWP', category: 'PRECISION', price: 4750 },
  ].map(item => ({
    ...item,
    owned: player.weapons.some(weapon => weapon.id === item.id),
    affordable: player.money >= item.price,
  }));
}

export function getOverlayModel(title, subtitle, buttonText) {
  return { title, subtitle, buttonText };
}
```

Update `HUD.update()` to toggle `nominal`, `warning`, and `critical` classes instead of assigning fill colors inline. Render buy rows with class names `owned`, `locked`, or `available`, and replace icons with labels such as `CREDITS`, `VITALS`, `MAG`, and `RESERVE`. Build overlay nodes with `replaceChildren()` and `textContent`, preserving the callback assignment on `#overlay-btn`.

- [ ] **Step 4: Rebuild HTML structure and CSS theme**

Keep every existing DOM ID referenced by `HUD` and `main.js`, but reorganize the visible labels:

```html
<header id="hud-top" class="hud-strip">
  <span class="hud-kicker">SECTOR // DUST-01</span>
  <span id="timer-display" class="hud-clock">01:45</span>
  <span id="wave-display">CONTACT 01</span>
</header>
```

Create a boot screen that reads as a field terminal: `PIXSTRIKE`, `TACTICAL SIMULATION`, `SECTOR DUST-01`, an amber deployment button, and two short control rows. Convert all `style="display:none"` attributes to the reusable `.is-hidden` class, while retaining behavior through HUD methods and the boot click handler.

Rewrite `css/style.css` around palette CSS variables, 1px/2px borders, clipped tactical corners, subtle scanline/dither overlays, and the original 8:5 canvas ratio. Avoid gradients that look glossy; translucent directional fades behind HUD text are allowed. Add responsive rules below 700px that reduce labels but keep health, ammo, timer, crosshair, and buy controls legible.

- [ ] **Step 5: Run HUD, full, and markup scans**

Run: `node --test tests/hud.test.js`

Expected: 3 HUD tests PASS.

Run: `npm test`

Expected: all tests PASS.

Run: `rg -n "[❤💰⏱🛒✅🎯💀]|style=" index.html js/ui/hud.js js/main.js`

Expected: no matches. If game messages in `main.js` still contain pictographs, replace them with `UI_COPY`-based plain tactical text before rerunning.

- [ ] **Step 6: Record verification checkpoint**

Record: `tactical-interface-green`, including HUD/full test counts and a clean markup scan.

---

### Task 5: Integration, stability, and browser visual acceptance

**Files:**
- Modify: `js/main.js`
- Modify: `docs/superpowers/plans/2026-08-20-tactical-industrial-visual-redesign.md`

**Interfaces:**
- Consumes: `UI_COPY`, all updated renderer/HUD contracts, existing browser startup flow.
- Produces: a stable playable page with no console errors and a documented acceptance result.

- [ ] **Step 1: Normalize remaining game copy without changing game rules**

Import `UI_COPY` in `main.js`. Replace celebratory pictographs and inconsistent Chinese/English fragments with concise mission-radio copy while leaving scores and timers unchanged:

```js
hud.showMsg(hit.isHeadshot ? `${UI_COPY.headshot} // +250` : `${UI_COPY.eliminated} // +100`);
```

Keep the start button error fallback understandable in Chinese and retain all pointer-lock, reset, round-gate, and purchase behavior.

- [ ] **Step 2: Run the complete automated verification**

Run: `npm test`

Expected: all tests PASS with zero failures, cancellations, or skips.

Run: `find js tests -name '*.js' -print0 | xargs -0 -n1 node --check`

Expected: every source and test file exits successfully.

Run: `rg -n "[❤💰⏱🛒✅🎯💀]|style=" index.html js css tests`

Expected: no UI emoji or inline-style matches.

- [ ] **Step 3: Launch the local game and perform browser smoke QA**

Run: `python3 -m http.server 4173`

Open: `http://127.0.0.1:4173`

Verify in this order:

1. Boot screen fits the viewport and contains no emoji, clipped text, or glossy modern styling.
2. Clicking deploy reveals the 8:5 game viewport and no console errors.
3. Walls show stable concrete/wood/brick/metal patterns while turning; objective tiles remain walkable.
4. The sky, floor, fog, enemy, and weapon share the approved muted tactical palette.
5. Mouse/Space fire still reduces ammo; muzzle flash, recoil, hit marker, kill feedback, and weapon switching still work.
6. Pressing `B` opens a usable equipment menu; money and ownership states update after purchase.
7. HUD essentials remain readable at desktop width and at a viewport narrower than 700px.

- [ ] **Step 4: Capture and compare visual evidence**

Capture one boot-screen screenshot and one in-game screenshot at 960×600 or an equivalent 8:5 viewport. Reject the build if any of these are visible: flat untextured walls, generic identical weapon silhouettes, bright saturated UI colors outside feedback states, emoji, mixed border styles, clipped HUD, or enemy art that does not align with hit regions.

- [ ] **Step 5: Run final tests after browser QA fixes**

Run: `npm test`

Expected: all tests PASS on the exact final working tree.

Run: `find js tests -name '*.js' -print0 | xargs -0 -n1 node --check`

Expected: all syntax checks PASS.

- [ ] **Step 6: Record final verification checkpoint**

Append the exact automated test totals, browser console result, smoke actions, viewport sizes, and screenshot paths under a `## Verification Record` section in this plan. Record the checkpoint name `visual-redesign-accepted`.

## Verification Record

**Checkpoint:** `visual-redesign-accepted`  
**Date:** 2026-08-20

- Automated tests: 48 passed; 0 failed, cancelled, skipped, or todo.
- JavaScript syntax: all files under `js/` and `tests/` passed `node --check`.
- UI hygiene: no target emoji and no `style=` attributes in `index.html`, `js/`, `css/`, or `tests/`.
- Browser console: no errors during boot, deployment, firing, equipment-menu toggle, or narrow-viewport checks.
- Browser performance: local page load completed in 38ms at 1280×720.
- Render cadence: 61 animation frames in 1004ms at 1280×720.
- Firing smoke: Space changed pistol ammo from `20 / ∞` to `19 / ∞`.
- Equipment smoke: B opened and closed the menu; owned and locked rows matched the $800 economy state.
- Responsive smoke: at 375×812 there was no horizontal overflow; game frame was 360×225 and both health and ammo remained visible.
- Screenshots:
  - `.gstack/design-reports/screenshots/first-impression.png`
  - `.gstack/design-reports/screenshots/in-game.png`
  - `.gstack/design-reports/screenshots/buy-menu.png`
  - `.gstack/design-reports/screenshots/in-game-mobile.png`
- Design audit: `.gstack/design-reports/design-audit-localhost-2026-08-20.md`
- Independent code re-review: no remaining Critical or Important findings; Ready.
