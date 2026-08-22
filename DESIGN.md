# PixStrike Design and Extension Guide

> Current architecture: browser-native ES modules, Canvas 2D raycasting, DOM/CSS operations UI, local profile persistence, and Node's built-in test runner.

## Product shape

PixStrike is an offline single-player tactical FPS. The operations hub is the durable shell around repeatable combat deployments: players choose one of 20 deterministic maps, buy and equip from a 12-weapon catalog, deploy, earn credits, return to the hub, and continue from a locally persisted profile.

The application has no build step and no backend. `index.html` loads `js/main.js`, which composes pure catalog/profile/session modules with the DOM, Canvas renderer, input, HUD, and storage boundary.

## Visual system

The approved direction is tactical-industrial pixel UI: dense field-terminal panels, squared controls, restrained scanlines, hard-edged shadows, compact monospaced labels, and high-contrast amber actions. Visual hierarchy should come from geometry, spacing, type weight, and the approved colors—not emoji or ad hoc inline styling.

Palette authority is shared deliberately:

- `css/style.css` `:root` variables are the CSS authority for the operations hub and HUD: ink, coal, gunmetal, concrete, sand, dust, olive, rust, amber, ivory, muted, safe, danger, panel, and line.
- `js/ui/theme.js` is the Canvas/runtime authority for corresponding tactical colors, UI copy, map materials, and all weapon silhouette records.

Extensions must reuse these authorities. Do not introduce inline `style` attributes, emoji status icons, a second palette, or an unconfigured weapon fallback. Pixel rendering must remain legible over decorative effects; scanlines stay non-interactive and subdued.

## Map architecture

The map pipeline has three boundaries:

1. `js/maps/catalog.js` owns immutable display and generation metadata. `MAP_SERIES` defines ship, plaza, alley, and street; `MAP_CATALOG` contains exactly five maps in each series (20 total); `DEFAULT_MAP_ID` is `ship-deck`.
2. `js/maps/generator.js` converts one definition into a deterministic integer grid using a project-local seeded PRNG and a series template. `buildMapPreview()` converts that grid to semantic preview cells.
3. `js/maps/validator.js` rejects malformed or unsafe output. It checks rectangular dimensions, legal tiles, closed wall boundaries, required player/enemy/target tiles, spawn adjacency, reachability from the player spawn, and the passable-area budget.

Tile meanings are: `0` floor; `1`–`4` wall materials; `5`/`6` targets A/B; `7` player spawn; and `8` enemy spawn. Generation never uses `Math.random()`, so a catalog entry's seed and variant always reproduce the same layout.

### Adding a map safely

1. Add one frozen catalog definition with a unique `id`, valid series, Chinese `name`, English `callout`, description, difficulty, width, height, seed, round time, tags, and the series-specific `variant` fields.
2. Reuse an existing series generator unless the product explicitly adds a new series. If a new series is approved, add its catalog metadata and generator branch together.
3. Generate the map twice and assert deep equality. Run `validateGeneratedMap()` and require `valid: true`; never bypass validation in deployment.
4. Add catalog ordering/count, determinism, validation, and preview tests in `tests/maps.test.js`.
5. Confirm the hub card, preview, filter, deployed HUD identity, spawn safety, and representative combat performance in a browser.

## Weapon architecture

`js/weapons/weapons.js` owns the ordered 12-weapon combat/store catalog: Glock-18, USP-S, Desert Eagle, MP9, UMP-45, Nova, XM1014, FAMAS, M4A1-S, AK-47, SSG 08, and AWP. Glock (`pistol`) has zero unlock cost and is always owned.

Each record includes stable identity, display name/category/description, `unlockPrice`, combat tuning, ammunition/reload behavior, spread and recoil values, and a five-axis `display` stat model used by hub cards. `js/ui/theme.js` must contain a dedicated `WEAPON_VISUALS` entry for every catalog ID.

`tryFire()` preserves a primary `hit` while returning all `hits`. Ordinary weapons trace one ray. Shotguns declare `pellets` and `pelletSpread`; one trigger pull consumes one shell and advances recoil/cooldown once, but traces every pellet. Runtime combat groups pellet hits by entity before applying aggregate damage and reports one feedback result for the trigger event.

### Adding a weapon safely

1. Add the weapon at the intended progression position with a unique stable ID, unlock price, complete combat tuning, and display metadata.
2. Add a dedicated first-person silhouette and hand anchors in `WEAPON_VISUALS`; do not rely on Glock geometry as a fallback.
3. Ensure profile normalization accepts the ID through the catalog, store/armory view models expose it, and deployment can instantiate it with `createWeapon()`.
4. For pellet weapons, test pellet count, injected deterministic randomness, aggregate damage, one-ammo consumption, and single-trigger recoil/cooldown.
5. Extend weapon, theme, and renderer tests, then verify store affordability/ownership, armory slot order, HUD switching, reload, and representative rendering in the browser.

## Profile, economy, and persistence

The storage key is `pixstrike.profile.v1`. Version 1 serializes this shape:

```json
{
  "version": 1,
  "credits": 1800,
  "ownedWeaponIds": ["pistol"],
  "equippedWeaponIds": ["pistol"],
  "selectedMapId": "ship-deck",
  "highestWaveByMap": {},
  "totalKills": 0
}
```

`js/profile/profile.js` owns defaults, normalization, and immutable domain actions. Purchase, equip toggle, and map selection return a result containing a new profile only on success; rejected actions preserve the input profile. At least one weapon must remain equipped, no more than four may be equipped, and only owned catalog IDs are retained. Kill and wave rewards return cloned profiles (+40 credits per kill; +450 credits per completed wave), while normalization repairs corrupt, stale, duplicated, negative, or unknown values.

`js/profile/storage.js` is the only localStorage-like boundary. `createProfileStorage()` catches reads, parsing, and writes, falls back to a valid default, and exposes `isPersistent`; storage failure never prevents play.

`js/profile/actions.js` supplies the action controller used by the hub. It composes one pure action, updates in-memory state, attempts persistence, refreshes hub view models, and maps the result to concise status copy. A failed save keeps the accepted in-memory action and reports a persistence warning. Purchases or armory changes during an active deployment do not mutate that run's already-instantiated weapon array.

## UI and session lifecycle

`js/ui/operations-hub.js` separates pure card/status models from the `OperationsHub` DOM controller. The hub renders map filters/catalog/detail preview, profile readouts, armory slots, and the weapon store using semantic controls and delegated handlers. Visible user content is built with DOM nodes and `replaceChildren`, not `innerHTML`. Responsive rules in `css/style.css` collapse the catalog/detail layout to one column at 375 px and retain at least 44 px interactive targets.

`js/ui/hud.js` owns deployed map identity and the B-key field armory. That menu lists only the current player's equipped weapon instances in slot order, contains no store price or purchase behavior, and switches through the same public selection path as Digit1–Digit4.

`js/engine/session.js` is the pure/runtime session boundary. The phase begins in `hub`; deployment and return transitions increment a monotonic deployment ID so stale round callbacks cannot revive an older run. `js/main.js` is the composition root:

- One-time initialization creates one input handler, renderer, HUD, feedback controller, keyboard registration, and `requestAnimationFrame` chain.
- Deployment resolves, generates, and validates the selected map; creates a fresh player and equipped weapon instances; resets run-only entities, score/wave state, timers, feedback, and HUD identity; then enters combat.
- Returning cancels pending round work, invalidates the deployment identity, resets input/feedback/run data, exits pointer lock when available, hides combat UI, and refreshes the operations hub.
- Redeployment reuses the long-lived runtime but creates a fresh run. The animation chain remains single and skips update/render work while the hub is active.

## Verification contract

Automated verification from the repository root:

```sh
npm test
find js tests -name '*.js' -print0 | xargs -0 -n1 node --check
rg -n '[❤💰⏱🛒✅🎯💀]|style=' index.html js css tests
```

The test suite must finish with zero failures, cancellations, skips, or todos; every JavaScript file must parse; and the hygiene search must produce no matches.

Browser acceptance uses a clean isolated origin. Desktop coverage must verify all four map filters, exact 20-map and 12-weapon counts, purchase/equip persistence, Digit1–Digit4 and B field-armory behavior, one deployed map per series, rewards, return/redeploy, reload restoration, no console errors, and representative frame sampling. Mobile coverage at 375×812 must verify document width equals viewport width, no horizontal overflow, reachable hub cards/actions, controls at least 44 px high, and a playable deployed Canvas. Performance evidence should report actual samples and any transient regression; it must not generalize representative 60–61 FPS samples into a claim that every map always sustains 60 FPS.
