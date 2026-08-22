# PixStrike Map, Armory, and Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 20-map operation selector, a persistent 12-weapon armory and store, and safe map switching around the existing single-player wave combat.

**Architecture:** Deterministic map catalog/generation, profile rules, storage, and UI view models live in focused modules with pure-function cores. `main.js` remains the composition root and separates one-time runtime initialization from repeatable deployment, so returning to the operations hub never duplicates listeners or animation loops.

**Tech Stack:** Browser-native ES modules, Canvas 2D, DOM/CSS, localStorage, Node.js built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-20-map-armory-store-design.md`

## Global Constraints

- Offline single-player Web game only; no backend, multiplayer, bomb mode, skins, attachments, or map editor.
- Exactly 20 deterministic maps: 5 ship, 5 plaza, 5 alley, and 5 street maps.
- Exactly 12 purchasable/equippable weapon definitions, with Glock-18 always owned.
- Profile key is `pixstrike.profile.v1`; storage failure must not prevent play.
- Maximum equipped weapons is 4; at least one equipped weapon must remain.
- New production behavior follows red-green-refactor and must preserve all existing tests.
- The workspace is not a Git repository, so each task ends with a verification checkpoint instead of a commit.

---

### Task 1: Deterministic Map Catalog and Generator

**Files:**
- Create: `js/maps/catalog.js`
- Create: `js/maps/generator.js`
- Create: `js/maps/validator.js`
- Create: `tests/maps.test.js`

**Interfaces:**
- Produces: `MAP_SERIES`, `MAP_CATALOG`, `DEFAULT_MAP_ID`, `getMapDefinition(id)`, `listMapsBySeries(series)`.
- Produces: `generateMap(definition) -> number[][]`, `buildMapPreview(grid) -> { width, height, cells }`.
- Produces: `validateGeneratedMap(grid, definition) -> { valid, errors, metrics }`.

- [x] **Step 1: Write catalog count and uniqueness tests**

```js
test('catalog contains five maps in each of four series', () => {
  assert.equal(MAP_CATALOG.length, 20);
  for (const series of MAP_SERIES) {
    assert.equal(listMapsBySeries(series.id).length, 5);
  }
  assert.equal(new Set(MAP_CATALOG.map(map => map.id)).size, 20);
});
```

- [x] **Step 2: Run the catalog test and verify RED**

Run: `node --test tests/maps.test.js`

Expected: module-not-found failure for `js/maps/catalog.js`.

- [x] **Step 3: Implement the exact 20-entry catalog**

Each frozen entry includes `id`, `series`, `name`, `callout`, `description`, `difficulty`, `width`, `height`, `seed`, `roundTime`, `tags`, and `variant`. Export the IDs and order from the approved spec verbatim.

- [x] **Step 4: Run the catalog test and verify GREEN**

Run: `node --test tests/maps.test.js`

Expected: catalog test passes.

- [x] **Step 5: Write deterministic generation and validation tests**

```js
test('every catalog map is deterministic and valid', () => {
  for (const definition of MAP_CATALOG) {
    const first = generateMap(definition);
    const second = generateMap(definition);
    assert.deepEqual(first, second, definition.id);
    const result = validateGeneratedMap(first, definition);
    assert.equal(result.valid, true, `${definition.id}: ${result.errors.join(', ')}`);
  }
});
```

Add focused negative tests for an open boundary, a disconnected enemy spawn, a ragged row, and an illegal tile.

- [x] **Step 6: Run generation tests and verify RED**

Run: `node --test tests/maps.test.js`

Expected: missing exports from generator and validator.

- [x] **Step 7: Implement seeded generation and four templates**

Use a project-local 32-bit seeded PRNG. Start every grid with a closed boundary, carve guaranteed connected lanes first, add template-specific walls and cover second, then stamp player spawn tile `7`, at least three enemy spawn tiles `8`, and target tiles `5` and `6`. Do not use `Math.random()`.

- [x] **Step 8: Implement validator and preview model**

Use BFS from the first player spawn, validate all required metrics, and expose a flattened preview cell model whose wall cells retain material IDs and special tiles have semantic kinds.

- [x] **Step 9: Run Task 1 verification checkpoint**

Run: `node --test tests/maps.test.js && npm test`

Expected: all map tests and all pre-existing tests pass.

---

### Task 2: Persistent Profile and Economy Rules

**Files:**
- Create: `js/profile/profile.js`
- Create: `js/profile/storage.js`
- Create: `tests/profile.test.js`

**Interfaces:**
- Produces: `PROFILE_KEY`, `createDefaultProfile()`, `normalizeProfile(value, catalogs)`, `purchaseWeapon(profile, id, weaponCatalog)`, `toggleEquippedWeapon(profile, id)`, `selectProfileMap(profile, mapId, mapCatalog)`, `awardKill(profile)`, `awardWave(profile, mapId, wave)`.
- Produces: `createProfileStorage(storage) -> { load(), save(profile), isPersistent }`.

- [x] **Step 1: Write normalization tests**

```js
test('normalization repairs corrupt identifiers and equipment limits', () => {
  const profile = normalizeProfile({
    version: 1,
    credits: -4,
    ownedWeaponIds: ['pistol', 'pistol', 'unknown'],
    equippedWeaponIds: ['unknown'],
    selectedMapId: 'missing',
  });
  assert.equal(profile.credits, 0);
  assert.deepEqual(profile.ownedWeaponIds, ['pistol']);
  assert.deepEqual(profile.equippedWeaponIds, ['pistol']);
  assert.equal(profile.selectedMapId, DEFAULT_MAP_ID);
});
```

- [x] **Step 2: Run profile test and verify RED**

Run: `node --test tests/profile.test.js`

Expected: module-not-found failure.

- [x] **Step 3: Implement default and normalization rules**

Default profile uses version 1, 1800 credits, Glock ownership/equipment, `ship-deck`, empty highest-wave object, and zero kills. Return fresh arrays/objects on every call.

- [x] **Step 4: Write purchase, equip, and reward tests**

Cover exact deduction, insufficient funds, duplicate ownership, unknown weapons, maximum four equipped weapons, refusal to remove the last equipped weapon, +40 kill reward, +450 wave reward, total kill count, and per-map highest wave.

- [x] **Step 5: Run rule tests and verify RED**

Run: `node --test tests/profile.test.js`

Expected: missing rule functions.

- [x] **Step 6: Implement immutable profile rules**

Every operation returns a new normalized profile on success and leaves input data untouched. Normal failures return `{ profile, ok: false, reason }` without throwing.

- [x] **Step 7: Write storage adapter tests**

Use a minimal in-memory Storage-compatible object. Cover valid load/save, malformed JSON fallback, `getItem` exception fallback, and `setItem` exception returning `false` without throwing.

- [x] **Step 8: Implement storage adapter**

Only `storage.js` may reference localStorage-like APIs. JSON parsing and storage exceptions are caught at this boundary.

- [x] **Step 9: Run Task 2 verification checkpoint**

Run: `node --test tests/profile.test.js && npm test`

Expected: all profile and regression tests pass.

---

### Task 3: Expand Combat Catalog to 12 Weapons

**Files:**
- Modify: `js/weapons/weapons.js`
- Modify: `js/ui/theme.js`
- Modify: `js/engine/renderer.js`
- Modify: `tests/weapons.test.js`
- Modify: `tests/renderer.test.js`
- Modify: `tests/theme.test.js`

**Interfaces:**
- Extends: `WEAPONS` to 12 definitions.
- Produces: every definition includes `unlockPrice`, `display`, and optional `pellets` / `pelletSpread`.
- Extends: `tryFire(...)` to return `hits: Array<{ entity, damage, isHeadshot, dist }>` while retaining `hit` as the nearest/primary hit for backward compatibility.
- Extends: `WEAPON_VISUALS` with a visual record for all 12 IDs.

- [x] **Step 1: Write catalog completeness tests**

```js
test('weapon catalog exposes all approved store weapons', () => {
  const ids = ['pistol', 'usp', 'deagle', 'uzi', 'ump45', 'nova',
    'xm1014', 'famas', 'm4a1', 'ak47', 'scout', 'awp'];
  assert.deepEqual(Object.keys(WEAPONS), ids);
  for (const id of ids) {
    assert.ok(WEAPONS[id].display);
    assert.ok(WEAPON_VISUALS[id]);
  }
});
```

- [x] **Step 2: Run catalog test and verify RED**

Run: `node --test tests/weapons.test.js tests/theme.test.js`

Expected: missing eight weapon definitions and visuals.

- [x] **Step 3: Add eight weapon definitions and display metadata**

Use the approved unlock prices and tune actual combat stats inside the existing easy-to-hit recoil envelope. Keep the current IDs and gun behavior compatible.

- [x] **Step 4: Add visual silhouettes**

Reuse the renderer's normalized weapon drawing primitives, but give pistol, SMG, shotgun, rifle, and precision categories distinct barrel/receiver/stock proportions. All 12 IDs must render without falling back to Glock geometry.

- [x] **Step 5: Write shotgun behavior tests**

Assert one ammo consumed per trigger pull, the configured pellet count is traced, damage can aggregate across pellets on one entity, and non-shotguns still return one-element-or-empty `hits`.

- [x] **Step 6: Run shotgun tests and verify RED**

Run: `node --test tests/weapons.test.js`

Expected: `tryFire` lacks pellet-aware `hits` behavior.

- [x] **Step 7: Implement pellet tracing with compatibility**

For `pellets > 1`, derive each pellet angle from the weapon's seeded/random callback around the effective spread, call the existing raycast function, and return all real hits. Consume ammunition and apply recoil once per trigger pull.

- [x] **Step 8: Run Task 3 verification checkpoint**

Run: `node --test tests/weapons.test.js tests/renderer.test.js tests/theme.test.js && npm test`

Expected: all weapon, renderer, theme, and regression tests pass.

---

### Task 4: Operations Hub View Models and DOM

**Files:**
- Create: `js/ui/operations-hub.js`
- Create: `tests/operations-hub.test.js`
- Modify: `index.html`
- Modify: `css/style.css`

**Interfaces:**
- Produces: `getMapCardModels(profile, filter)`, `getStoreCardModels(profile)`, `getArmoryCardModels(profile)`, `renderPreviewToCanvas(canvas, grid)`.
- Produces: `OperationsHub` with callbacks `onDeploy(mapId)`, `onPurchase(weaponId)`, `onToggleEquip(weaponId)`, and methods `show(profile)`, `hide()`, `setStatus(message, tone)`, `refresh(profile)`.

- [x] **Step 1: Write pure view-model tests**

Cover selected map state, series filtering, owned/affordable/locked store states, equipped slot order, and display of 12 weapon cards.

- [x] **Step 2: Run view-model tests and verify RED**

Run: `node --test tests/operations-hub.test.js`

Expected: module-not-found failure.

- [x] **Step 3: Implement view models without DOM dependencies**

View models consume approved catalog/profile APIs and return strings, numbers, booleans, and arrays only. They must not mutate the profile.

- [x] **Step 4: Run view-model tests and verify GREEN**

Run: `node --test tests/operations-hub.test.js`

Expected: pure model tests pass.

- [x] **Step 5: Replace boot content with operations hub structure**

Add tab buttons, profile summary, map filters, map list, detail panel, preview canvas, armory grid, store grid, status region, and deployment action. Keep `boot-screen`, `game-container`, and `start-btn` IDs compatible where practical.

- [x] **Step 6: Implement hub DOM controller**

Create semantic buttons with `data-*` IDs, use `replaceChildren`, attach one delegated click handler per container, and update `aria-selected`, disabled states, and status text. Never build user-visible HTML with `innerHTML`.

- [x] **Step 7: Add responsive tactical styling**

Use the existing palette and typography. Desktop uses catalog/detail columns; mobile uses one column. Interactive targets are at least 44px high, scroll areas have visible focus styles, and the page has no horizontal overflow at 375px.

- [x] **Step 8: Run Task 4 verification checkpoint**

Run: `node --test tests/operations-hub.test.js && npm test && node --check js/ui/operations-hub.js`

Expected: hub model and all regression tests pass; syntax is valid.

---

### Task 5: HUD Armory and Map Identity

**Files:**
- Modify: `js/ui/hud.js`
- Modify: `index.html`
- Modify: `css/style.css`
- Modify: `tests/hud.test.js`

**Interfaces:**
- Changes: `getEquipmentRows(player)` reads current equipped weapon instances rather than a hard-coded store catalog.
- Adds: `HUD.setMapIdentity(definition)`.
- Changes: B-menu copy and rows to current field armory, with no pricing or purchase action.

- [x] **Step 1: Write HUD model tests**

Assert equipment rows preserve player weapon order, contain slot labels 1–4, expose selected state, and omit store prices. Assert map identity model returns Chinese name and callout.

- [x] **Step 2: Run HUD tests and verify RED**

Run: `node --test tests/hud.test.js`

Expected: hard-coded four-item requisition rows do not match equipped weapons.

- [x] **Step 3: Implement field armory and map identity**

Update DOM references and copy, render only player weapons, select via the existing public game callback, and update the HUD map label on deployment.

- [x] **Step 4: Run Task 5 verification checkpoint**

Run: `node --test tests/hud.test.js && npm test`

Expected: HUD and all regression tests pass.

---

### Task 6: Repeatable Game Session and Map Switching

**Files:**
- Create: `js/engine/session.js`
- Create: `tests/session.test.js`
- Modify: `js/main.js`
- Modify: `tests/startup.test.js`

**Interfaces:**
- Produces: `createSessionState()` and pure transition helpers `beginDeployment(state, operation)`, `returnToHub(state)`, `resetRunState(state)`.
- Main runtime methods: `initializeRuntime()`, `deployOperation(mapId)`, `returnToOperations()`.

- [x] **Step 1: Write session transition tests**

Assert deployment activates a selected operation, return-to-hub clears pending restart identity, and a second deployment resets wave/score/entities without changing persistent profile data.

- [x] **Step 2: Run session tests and verify RED**

Run: `node --test tests/session.test.js`

Expected: module-not-found failure.

- [x] **Step 3: Implement pure session transitions**

Keep timers and DOM out of the pure module. Use monotonically increasing deployment tokens so stale round callbacks cannot restart a later operation.

- [x] **Step 4: Refactor one-time runtime initialization**

Create input, renderer, HUD, feedback, one key listener, and one animation loop once. Gate updates and rendering on active session state.

- [x] **Step 5: Implement operation deployment**

Resolve and generate the selected map, validate before activation, create a fresh player at the map's CT spawn, instantiate equipped weapons, set map identity, reset wave state, persist selection, then show the game and lock pointer.

- [x] **Step 6: Implement return to operations**

Cancel the round restart timeout, invalidate the deployment token, reset input/feedback, exit pointer lock when available, hide combat UI, refresh the hub profile, and show the hub.

- [x] **Step 7: Integrate profile rewards and pellet hits**

Award +40 per enemy kill once, +450 per completed wave once, save after each reward, aggregate pellet damage by enemy, and preserve one hit/kill feedback event per trigger result.

- [x] **Step 8: Add death overlay choices**

Expose “重新部署” and “返回作战中心”. Redeploy uses the current map and loadout; return performs full session cleanup.

- [x] **Step 9: Run Task 6 verification checkpoint**

Run: `node --test tests/session.test.js tests/startup.test.js && npm test`

Expected: session/startup and all regression tests pass with no duplicate initialization behavior.

---

### Task 7: Store, Armory, and Profile Integration

**Files:**
- Modify: `js/main.js`
- Modify: `js/ui/operations-hub.js`
- Modify: `tests/operations-hub.test.js`
- Modify: `tests/profile.test.js`

**Interfaces:**
- Main callbacks: `handlePurchase(weaponId)`, `handleToggleEquip(weaponId)`, `handleSelectMap(mapId)`, `persistProfile(nextProfile)`.

- [x] **Step 1: Write integration-facing callback tests through pure rules**

Cover purchase then equip, unaffordable status, full-slot status, map selection persistence, and save failure returning a warning while retaining the in-memory profile.

- [x] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/profile.test.js tests/operations-hub.test.js`

Expected: missing integration result/status mappings.

- [x] **Step 3: Implement callback composition**

Each callback applies one pure profile rule, updates in-memory state on success, attempts persistence, refreshes the hub, and maps machine reasons to concise Chinese status copy.

- [x] **Step 4: Ensure deployment uses equipped IDs in order**

Create weapon instances at deployment time and expose slots through Digit1–Digit4 and the B field armory. Store purchases never mutate an already active run's weapon array.

- [x] **Step 5: Run Task 7 verification checkpoint**

Run: `node --test tests/profile.test.js tests/operations-hub.test.js tests/hud.test.js && npm test`

Expected: all profile, hub, HUD, and regression tests pass.

---

### Task 8: Final Validation and Documentation

**Files:**
- Modify: `css/style.css`
- Modify: `DESIGN.md`
- Modify: `docs/superpowers/plans/2026-08-20-map-armory-store.md`
- Create: `.gstack/design-reports/map-armory-store-audit-2026-08-21.md`
- Create: `.gstack/design-reports/map-armory-store-baseline.json`
- Create: `.superpowers/sdd/2026-08-20-map-armory-store/task-8-report.md`

**Interfaces:**
- No new runtime API.

- [x] **Step 1: Run the complete automated suite**

Run: `npm test`

Expected: zero failures, cancellations, skips, or todos.

- [x] **Step 2: Run syntax and hygiene checks**

Run: `find js tests -name '*.js' -print0 | xargs -0 -n1 node --check`

Run: `rg -n '[❤💰⏱🛒✅🎯💀]|style=' index.html js css tests`

Expected: syntax command exits 0; hygiene search returns no matches.

- [ ] **Step 3: Perform desktop browser acceptance (partial — reward observation remains automated-only)**

At 1280×720: filter all four map series, deploy one map from each series, purchase and equip a weapon, use Digit1–Digit4 and B, earn credits from a kill/wave, return to hub, refresh, and confirm restored state. Capture map, armory, store, and in-game screenshots.

- [x] **Step 4: Perform mobile browser acceptance**

At 375×812: verify no horizontal overflow, all cards/actions remain reachable, and deploy still enters a playable 360×225 game canvas.

- [x] **Step 5: Measure runtime stability**

Confirm browser console has no errors and sample `requestAnimationFrame` for about one second during combat; target approximately 60 frames.

- [x] **Step 6: Update documentation and verification record**

Document architecture, profile key/schema, map generator rules, weapon/store rules, test counts, screenshots, FPS sample, and any accepted limitations. Mark every plan checkbox with the real completed status.

- [x] **Step 7: Run final verification checkpoint**

Run: `npm test && find js tests -name '*.js' -print0 | xargs -0 -n1 node --check`

Expected: final working tree passes the full suite and syntax validation.

## Final Verification Record — 2026-08-21

Task 8 used the controller's browser acceptance evidence from isolated origin `127.0.0.1:4174` and reran all repository-local automation after the CSS/documentation changes.

### Automated results

| Check | Exact result |
|---|---|
| `npm test` | Exit 0; 117 tests, 117 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo; `duration_ms 7935.910827`. |
| `find js tests -name '*.js' -print0 \| xargs -0 -n1 node --check` | Exit 0; no syntax diagnostics. |
| `rg -n '[❤💰⏱🛒✅🎯💀]\|style=' index.html js css tests` | No matches (the raw search exit was 1, as expected for an empty result; the verification wrapper exited 0). |
| Baseline JSON | `JSON.parse` succeeded; test count 117 and eight screenshot paths present. |
| Screenshot existence | All eight required screenshot files exist. |
| CSS cleanup | One top-level `#boot-screen` block remains; no orphan boot selector matches remain. |

### Browser acceptance evidence

- Desktop hub: 20 map cards, `ship-deck` default, 1,800 credits, and no horizontal overflow.
- Store/armory: 12 cards, five initially affordable; USP-S purchase reported `已解锁 USP-S`; persisted credits were 1,400 with loadout order `['pistol', 'usp']`.
- Map/deploy: Street filter returned five maps; `street-industrial` preview and `工业长街 // INDUSTRIAL` HUD identity rendered; Digit2 selected USP-S and B opened field armory.
- Series coverage: `货舱迷宫 // CARGO HOLD`, `旧城集市 // OLD MARKET`, `红砖暗巷 // BRICK ALLEY`, and `十字街口 // CROSSING` were deployed.
- Reload persistence: 1,400 credits, USP-S ownership/equipment, and `street-crossing` selection restored.
- Mobile 375×812: document width equaled viewport width (375), no horizontal overflow, no visible button was below 44 px, and a deployed game container measured 360×225 px (canvas content 356×221 px).
- Runtime: zero console errors; page-load sample 96 ms; hub 61 FPS, `ship-deck` 60 FPS, `alley-brick` 61 FPS, `street-crossing` 60 FPS. One plaza sample transiently measured 46 FPS and remains documented as a monitoring concern.
- Reward mutations and their persistence boundaries are covered by the passing profile/session automated tests. The supplied browser evidence does not claim a separately captured kill/wave reward observation: a fixed-angle headless run expended ammunition but did not register a hit, so this desktop sub-check remains intentionally incomplete rather than being inferred from code.

### Artifacts

- Architecture and extension guide: `DESIGN.md`
- Human-readable audit: `.gstack/design-reports/map-armory-store-audit-2026-08-21.md`
- Machine-readable baseline: `.gstack/design-reports/map-armory-store-baseline.json`
- Task report: `.superpowers/sdd/2026-08-20-map-armory-store/task-8-report.md`
