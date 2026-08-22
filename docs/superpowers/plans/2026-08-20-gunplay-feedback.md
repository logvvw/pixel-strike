# PixStrike Gunplay Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the existing single-map game loop and add approachable CS-style recoil, spread, muzzle flash, hit markers, and kill feedback.

**Architecture:** Keep hitscan raycasting and move gun-handling calculations into testable weapon functions plus a small time-based `CombatFeedback` state object. `main.js` converts input into shot events, while `Renderer` and `HUD` consume feedback state without owning combat rules.

**Tech Stack:** Browser ES modules, Canvas 2D, DOM/CSS, Node.js built-in `node:test` with no third-party dependencies.

**Spec:** `docs/superpowers/specs/2026-08-20-gunplay-feedback-design.md`

## Global Constraints

- Stability of the current single-map loop is the highest priority.
- Preserve the current map format, buying flow, wave loop, and raycasting renderer.
- Do not implement additional maps, bomb mode, networking, penetration, projectiles, crouching, or scoped aiming.
- Draw weapon and feedback graphics with Canvas/CSS; do not add external image assets.
- The directory has no Git metadata, so commit steps are replaced by explicit verification checkpoints.

---

## File Structure

- Create `package.json`: declare ES modules and the built-in test command.
- Create `tests/weapons.test.js`: weapon damage, shot-event, spread, cooldown, recovery, and wall-occlusion tests.
- Create `tests/feedback.test.js`: time-based muzzle, hit, headshot, kill, and reset tests.
- Create `js/engine/feedback.js`: UI-agnostic combat feedback state.
- Modify `js/weapons/weapons.js`: weapon handling parameters, shot state, deterministic random injection, and structured shot result.
- Modify `js/engine/input.js`: mouse-button edge/held state and focus reset.
- Modify `js/engine/player.js`: movement intensity and time-based visual recoil state.
- Modify `js/engine/renderer.js`: weapon view model, muzzle flash, camera kick, and hit spark rendering.
- Modify `js/ui/hud.js`: dynamic crosshair, hit marker, kill feed, and low-ammo state.
- Modify `js/main.js`: stable event orchestration and cleanup at round boundaries.
- Modify `index.html`: semantic HUD layers for crosshair, hit marker, and kill feed.
- Modify `css/style.css`: pixel-styled feedback layers and responsive HUD rules.

### Task 1: Stabilize Hitscan Damage and Shot Results

**Files:**
- Create: `package.json`
- Create: `tests/weapons.test.js`
- Modify: `js/weapons/weapons.js:5-202`

**Interfaces:**
- Produces: `tryFire(weapon, player, entities, map, now, options?) -> ShotResult`
- Produces: `ShotResult = { fired, reason, hit, rayAngle, spread, recoil }`
- Produces: `updateWeaponHandling(weapon, dt, now) -> void`
- Consumes: existing `createWeapon`, `raycastHit`, `reloadWeapon`, and `updateReload` exports.

- [ ] **Step 1: Add the ES-module test harness and failing stability tests**

```json
{
  "name": "pix-strike",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.js"
  }
}
```

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWeapon, tryFire } from '../js/weapons/weapons.js';

const openMap = Array.from({ length: 7 }, (_, y) =>
  Array.from({ length: 7 }, (_, x) => x === 0 || y === 0 || x === 6 || y === 6 ? 1 : 0)
);

test('a fired pistol shot carries weapon damage', () => {
  const weapon = createWeapon('pistol');
  const enemy = { x: 3, y: 1, radius: 0.3, alive: true };
  const shot = tryFire(weapon, { x: 1, y: 1, angle: 0 }, [enemy], openMap, 1000, { random: () => 0.5 });
  assert.equal(shot.fired, true);
  assert.equal(shot.hit.entity, enemy);
  assert.equal(shot.hit.damage, weapon.damage);
});

test('a miss still returns a fired shot event', () => {
  const weapon = createWeapon('pistol');
  const shot = tryFire(weapon, { x: 1, y: 1, angle: Math.PI }, [], openMap, 1000, { random: () => 0.5 });
  assert.equal(shot.fired, true);
  assert.equal(shot.hit, null);
  assert.equal(weapon.currentAmmo, weapon.magazine - 1);
});

test('cooldown returns a non-fired result without consuming ammo', () => {
  const weapon = createWeapon('pistol');
  tryFire(weapon, { x: 1, y: 1, angle: 0 }, [], openMap, 1000, { random: () => 0.5 });
  const ammo = weapon.currentAmmo;
  const shot = tryFire(weapon, { x: 1, y: 1, angle: 0 }, [], openMap, 1050, { random: () => 0.5 });
  assert.deepEqual({ fired: shot.fired, reason: shot.reason }, { fired: false, reason: 'cooldown' });
  assert.equal(weapon.currentAmmo, ammo);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/weapons.test.js`

Expected: FAIL because the current API returns `null` on misses and calculates hit damage from the target instead of the weapon.

- [ ] **Step 3: Return structured shot results and source damage from the weapon**

```js
const NOT_FIRED = reason => ({ fired: false, reason, hit: null });

export function tryFire(weapon, player, entities, map, now, options = {}) {
  const random = options.random ?? Math.random;
  if (weapon.reloading) return NOT_FIRED('reloading');
  if (weapon.currentAmmo <= 0) {
    reloadWeapon(weapon, player, now);
    return NOT_FIRED('empty');
  }
  if (now - weapon.lastFireTime < weapon.fireRate) return NOT_FIRED('cooldown');

  weapon.currentAmmo--;
  weapon.lastFireTime = now;
  const spreadOffset = (random() - 0.5) * weapon.currentSpread;
  const rayAngle = player.angle + spreadOffset;
  const hit = raycastHit(player.x, player.y, rayAngle, weapon.range, entities, map);
  if (hit) hit.damage = hit.isHeadshot ? weapon.damage * weapon.headshotMult : weapon.damage;
  return { fired: true, reason: null, hit, rayAngle, spread: weapon.currentSpread, recoil: null };
}
```

Also change `reloadWeapon(weapon, player, now = performance.now())` so tests and the game use the same clock source.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/weapons.test.js`

Expected: 3 tests pass with zero failures.

- [ ] **Step 5: Verification checkpoint**

Run: `node --check js/weapons/weapons.js && node --test tests/weapons.test.js`

Expected: both commands exit 0.

### Task 2: Add Deterministic Spread and Recoil State

**Files:**
- Modify: `tests/weapons.test.js`
- Modify: `js/weapons/weapons.js:5-120`

**Interfaces:**
- Consumes: `tryFire(..., options)` from Task 1.
- Produces: weapon fields `currentSpread`, `shotIndex`, `recoilX`, `recoilY`, and `lastShotAt`.
- Produces: `updateWeaponHandling(weapon, dt, now) -> void`.

- [ ] **Step 1: Write failing handling tests**

```js
import { createWeapon, tryFire, updateWeaponHandling } from '../js/weapons/weapons.js';

test('movement and repeated fire increase spread up to the weapon cap', () => {
  const weapon = createWeapon('ak47');
  const player = { x: 1, y: 1, angle: Math.PI, movementIntensity: 1 };
  const first = tryFire(weapon, player, [], openMap, 1000, { random: () => 0.5 });
  const second = tryFire(weapon, player, [], openMap, 1100, { random: () => 0.5 });
  assert.ok(first.spread > weapon.baseSpread);
  assert.ok(second.spread > first.spread);
  assert.ok(second.spread <= weapon.maxSpread);
});

test('handling recovers after the reset delay', () => {
  const weapon = createWeapon('ak47');
  tryFire(weapon, { x: 1, y: 1, angle: 0, movementIntensity: 0 }, [], openMap, 1000, { random: () => 0.5 });
  const spreadAfterShot = weapon.currentSpread;
  updateWeaponHandling(weapon, 0.5, 1600);
  assert.ok(weapon.currentSpread < spreadAfterShot);
  assert.equal(weapon.shotIndex, 0);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/weapons.test.js`

Expected: FAIL because handling fields and `updateWeaponHandling` do not exist.

- [ ] **Step 3: Add per-weapon handling parameters and state updates**

Add parameters named exactly `baseSpread`, `moveSpread`, `shotSpread`, `maxSpread`, `spreadRecovery`, `recoilPitch`, `recoilYaw`, `recoilRecovery`, and `kick` to all four definitions. Initialize handling state in `createWeapon`. Use a repeating horizontal recoil sequence `[-1, 0.5, 1, -0.5, 0.75, -0.75]`, cap spread with `Math.min`, and reset `shotIndex` after 220 ms without firing.

```js
export function updateWeaponHandling(weapon, dt, now) {
  const canReset = now - weapon.lastShotAt > 220;
  weapon.currentSpread = Math.max(weapon.baseSpread, weapon.currentSpread - weapon.spreadRecovery * dt);
  weapon.recoilX = approach(weapon.recoilX, 0, weapon.recoilRecovery * dt);
  weapon.recoilY = approach(weapon.recoilY, 0, weapon.recoilRecovery * dt);
  if (canReset && weapon.currentSpread <= weapon.baseSpread + 0.001) weapon.shotIndex = 0;
}
```

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test tests/weapons.test.js`

Expected: all weapon tests pass.

- [ ] **Step 5: Verification checkpoint**

Run: `node --check js/weapons/weapons.js && node --test tests/weapons.test.js`

Expected: both commands exit 0.

### Task 3: Add Time-Based Combat Feedback State

**Files:**
- Create: `tests/feedback.test.js`
- Create: `js/engine/feedback.js`

**Interfaces:**
- Produces: `CombatFeedback` with `onShot(shot)`, `onHit(kind)`, `onKill(isHeadshot)`, `update(dt)`, and `reset()`.
- Produces public state: `muzzle`, `weaponKick`, `screenKick`, `hitMarker`, `hitMarkerTime`, `killPulse`, and `wallSpark`.

- [ ] **Step 1: Write the failing feedback tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { CombatFeedback } from '../js/engine/feedback.js';

test('shot feedback decays with elapsed time', () => {
  const feedback = new CombatFeedback();
  feedback.onShot({ fired: true, recoil: { kick: 1 } });
  assert.ok(feedback.muzzle > 0);
  feedback.update(0.2);
  assert.equal(feedback.muzzle, 0);
  assert.ok(feedback.weaponKick < 1);
});

test('kill feedback outranks a normal hit and reset clears it', () => {
  const feedback = new CombatFeedback();
  feedback.onHit('hit');
  feedback.onKill(true);
  assert.equal(feedback.hitMarker, 'headshot-kill');
  feedback.reset();
  assert.equal(feedback.hitMarker, null);
  assert.equal(feedback.killPulse, 0);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/feedback.test.js`

Expected: FAIL with module-not-found for `js/engine/feedback.js`.

- [ ] **Step 3: Implement the minimal feedback state object**

```js
export class CombatFeedback {
  constructor() { this.reset(); }
  onShot(shot) {
    if (!shot?.fired) return;
    this.muzzle = 0.055;
    this.weaponKick = Math.max(this.weaponKick, shot.recoil?.kick ?? 0.5);
    this.screenKick = Math.max(this.screenKick, (shot.recoil?.kick ?? 0.5) * 0.35);
  }
  onHit(kind = 'hit') {
    this.hitMarker = kind;
    this.hitMarkerTime = kind === 'headshot' ? 0.17 : 0.11;
  }
  onKill(isHeadshot = false) {
    this.hitMarker = isHeadshot ? 'headshot-kill' : 'kill';
    this.hitMarkerTime = 0.22;
    this.killPulse = 1;
  }
  update(dt) {
    this.muzzle = Math.max(0, this.muzzle - dt);
    this.hitMarkerTime = Math.max(0, this.hitMarkerTime - dt);
    if (this.hitMarkerTime === 0) this.hitMarker = null;
    this.weaponKick = Math.max(0, this.weaponKick - dt * 7);
    this.screenKick = Math.max(0, this.screenKick - dt * 9);
    this.killPulse = Math.max(0, this.killPulse - dt * 4);
  }
  reset() {
    this.muzzle = 0;
    this.weaponKick = 0;
    this.screenKick = 0;
    this.hitMarker = null;
    this.hitMarkerTime = 0;
    this.killPulse = 0;
    this.wallSpark = null;
  }
}
```

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test tests/feedback.test.js`

Expected: 2 tests pass.

- [ ] **Step 5: Verification checkpoint**

Run: `npm test`

Expected: all weapon and feedback tests pass.

### Task 4: Add Stable Mouse Input and Player Handling State

**Files:**
- Modify: `js/engine/input.js:5-56`
- Modify: `js/engine/player.js:10-95`
- Modify: `index.html:12-18`

**Interfaces:**
- Produces: `InputHandler.isMouseHeld(button)`, `InputHandler.mouseJustPressed(button)`, and `InputHandler.reset()`.
- Produces: `Player.movementIntensity`, `Player.weaponBob`, `Player.recoilX`, and `Player.recoilY`.
- Produces: `Player.applyWeaponRecoil(recoil)` and `Player.updateWeaponHandling(dt)`.

- [ ] **Step 1: Add a player-state test to `tests/weapons.test.js`**

```js
import { Player } from '../js/engine/player.js';

test('player weapon recoil decays toward neutral', () => {
  const player = new Player(1, 1, 0);
  player.applyWeaponRecoil({ x: 0.02, y: 1, kick: 1 });
  const initial = player.recoilY;
  player.updateWeaponHandling(0.25);
  assert.ok(player.recoilY < initial);
  assert.ok(player.recoilY >= 0);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/weapons.test.js`

Expected: FAIL because player recoil methods do not exist.

- [ ] **Step 3: Implement input reset and player handling state**

Track `mouseButtons`, `previousMouseButtons`, and `pressedMouseButtons` on `mousedown`/`mouseup`; clear all key and button state on `window.blur` and `document.visibilitychange`. Prevent the context menu over the game canvas. In `Player.move`, assign `movementIntensity` after normalizing movement; update `weaponBob` from actual movement rather than raw key state.

- [ ] **Step 4: Run tests and syntax checks**

Run: `node --test tests/weapons.test.js && node --check js/engine/input.js && node --check js/engine/player.js`

Expected: all commands exit 0.

- [ ] **Step 5: Verification checkpoint**

Confirm the start-screen control copy names mouse-left as the primary fire control and Space as an alternate.

### Task 5: Integrate Renderer, HUD, and Main Loop Feedback

**Files:**
- Modify: `js/engine/renderer.js:58-354`
- Modify: `js/ui/hud.js:5-125`
- Modify: `js/main.js:4-238`
- Modify: `index.html:23-59`
- Modify: `css/style.css:1-304`

**Interfaces:**
- Consumes: `CombatFeedback` and structured `ShotResult`.
- Produces: `Renderer.render(player, map, entities, feedback)`.
- Produces: `HUD.update(player, feedback)`, `HUD.showKillFeed(weaponName, isHeadshot)`, and `HUD.resetCombatFeedback()`.

- [ ] **Step 1: Add DOM layers and CSS states**

```html
<div id="crosshair" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
<div id="hit-marker" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
<div id="kill-feed" aria-live="polite"></div>
```

Use four absolutely positioned 1–2 pixel arms for both the crosshair and hit marker. Drive crosshair gap with CSS custom property `--spread`; use `.headshot`, `.kill`, and `.headshot-kill` classes for marker color and weight.

- [ ] **Step 2: Draw a procedural pixel weapon and muzzle flash**

Add `drawWeapon(player, feedback)` after the world sprites. Use filled rectangles in weapon-specific palettes, translate by player bob and feedback kick, and render a 2–3-frame blocky muzzle shape while `feedback.muzzle > 0`. Do not allocate images or gradients per frame.

- [ ] **Step 3: Wire HUD state**

In `HUD.update`, set `--spread` from the current weapon spread normalized against `maxSpread`; toggle hit-marker classes from `feedback.hitMarker`. `showKillFeed` creates one bounded row and removes it after 1800 ms; keep at most four rows.

- [ ] **Step 4: Wire shot events in `main.js`**

```js
const feedback = new CombatFeedback();

function fireWeapon(weapon) {
  const shot = tryFire(weapon, player, entities, mapData, performance.now());
  if (!shot.fired) return;
  player.applyWeaponRecoil(shot.recoil);
  feedback.onShot(shot);
  if (shot.hit) applyHit(shot.hit, weapon);
}
```

Update weapon/player/feedback decay every frame. Use mouse held for automatic weapons and mouse edge for semi-automatic weapons, retaining Space equivalents. Reset feedback on round start, death restart, weapon switch, and buy-menu opening.

- [ ] **Step 5: Run syntax and unit verification**

Run: `npm test && node --check js/main.js && node --check js/engine/renderer.js && node --check js/ui/hud.js`

Expected: all commands exit 0.

### Task 6: Browser Stability and Playability Verification

**Files:**
- Modify only files implicated by verified failures from the checks below.

**Interfaces:**
- Consumes: completed single-map game.
- Produces: a stable start-to-restart browser flow with no uncaught console errors.

- [ ] **Step 1: Start a local static server**

Run: `python3 -m http.server 4173`

Expected: server listens on `http://127.0.0.1:4173`.

- [ ] **Step 2: Exercise the critical browser path**

Open the game, click Start, acquire pointer lock, move, fire with mouse-left and Space, empty a magazine, reload, buy/switch a weapon, kill an enemy, die, and restart.

Expected: every action completes without a frozen input state, duplicate scoring, stale feedback, or blocking overlay.

- [ ] **Step 3: Inspect console and runtime state**

Expected: zero uncaught exceptions, zero failed local resource requests, positive damage on every registered hit, and animation frame updates continuing after round transitions.

- [ ] **Step 4: Run final automated verification**

Run: `npm test && node --check js/main.js && node --check js/engine/*.js && node --check js/weapons/*.js && node --check js/ui/*.js`

Expected: full test suite passes and every JavaScript file parses.

- [ ] **Step 5: Compare implementation against the spec**

Confirm the implementation covers both fire controls, static/moving/continuous spread, recoil recovery, muzzle flash, weapon kick, dynamic crosshair, hit/headshot/kill markers, kill feed, empty/reload suppression, round reset, focus reset, and single-kill scoring. Record additional maps and modes as out of scope.
