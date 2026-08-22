# PIXSTRIKE // Tactical Simulation

> Offline single-player tactical FPS running entirely in the browser — Canvas 2D raycasting, deterministic map generation, weapon economy, and a persistent operations hub. No build step, no backend, no external runtime dependencies.

PixStrike pairs a top-down 2D field with first-person raycasted combat. Players move through deterministic maps, choose from 12 weapons (pistols, SMGs, shotguns, rifles, sniper), earn credits per kill and per wave, and return to a tactical-industrial operations hub to deploy again. All progress is stored locally.

## Highlights

- **20 deterministic maps** across 4 series (ship / plaza / alley / street), generated from seeded PRNG so every layout reproduces byte-for-byte.
- **12-weapon combat catalog** (Glock-18, USP-S, Desert Eagle, MP9, UMP-45, Nova, XM1014, FAMAS, M4A1-S, AK-47, SSG 08, AWP) with pellet shotguns, headshot multipliers, recoil, and reload.
- **First-person raycasted renderer** (320×200 internal framebuffer upscaled to the canvas) with sprite-based enemies, muzzle flash, and scanline overlays.
- **Operations hub** — DOM/CSS tactical-industrial UI for map selection, armory, and store; field armory (B key) switches weapons during a run.
- **Persistent profile** under `localStorage["pixstrike.profile.v1"]` — credits, owned/equipped weapons (1–4 slots), selected map, highest wave per map, total kills.
- **Pure / runtime split** — catalog, profile, and session modules are pure; engine modules own the runtime; `main.js` is the only composition root.

## Tech stack

| Layer            | Choice                                                              |
| ---------------- | ------------------------------------------------------------------- |
| Runtime          | Browser-native **ES Modules**, Node ≥ 18 for tests                  |
| Rendering        | **Canvas 2D** raycasting + DOM/CSS HUD                               |
| Language         | Vanilla **JavaScript** (no TypeScript, no transpiler)               |
| UI styling       | Hand-authored **CSS** with `:root` token palette                    |
| Persistence      | **`localStorage`** behind a single storage boundary                 |
| Tests            | Node's built-in **`node --test`** runner, zero deps                  |
| Package manager  | **pnpm** (`packageManager` pinned in `package.json`)                |
| Build / bundler  | **None** — `index.html` loads `js/main.js` directly                 |

No webpack, no Vite, no React, no framework. The whole game ships as static files plus one HTTP server.

## Project layout

```
.
├── index.html              # Boot screen, operations hub markup, canvas mount
├── css/
│   └── style.css           # Tactical-industrial palette (:root tokens), responsive rules
├── js/
│   ├── main.js             # Composition root — wires modules, owns one RAF loop
│   ├── engine/             # Runtime: renderer, player, combat, input, sound, session
│   │   ├── renderer.js     # Canvas 2D raycasting + sprite pass
│   │   ├── player.js       # Movement, view bob, recoil, weapon instance
│   │   ├── combat-controller.js
│   │   ├── entity.js       # Enemy / target entities
│   │   ├── enemy-silhouette.js
│   │   ├── feedback.js     # Hit markers, damage numbers, crosshair pulse
│   │   ├── input.js        # Keyboard, mouse, pointer lock
│   │   ├── map.js          # Tile collision + raycast DDA helpers
│   │   ├── round.js        # Wave / timer / score state
│   │   ├── session.js      # hub ↔ combat lifecycle, monotonic deployment ID
│   │   ├── sound.js        # WebAudio, lazily armed on user gesture
│   │   └── startup.js
│   ├── maps/
│   │   ├── catalog.js      # Frozen MAP_SERIES + MAP_CATALOG (20 entries)
│   │   ├── generator.js    # Seeded PRNG, series templates → integer grid
│   │   └── validator.js    # Rectangular bounds, closed walls, reachability, spawn safety
│   ├── weapons/
│   │   └── weapons.js      # 12-weapon catalog, createWeapon(), tryFire()
│   ├── profile/
│   │   ├── profile.js      # Defaults, normalization, pure domain actions
│   │   ├── storage.js      # localStorage boundary (createProfileStorage)
│   │   └── actions.js      # Action controller used by the hub
│   └── ui/
│       ├── operations-hub.js  # DOM controller + pure card/status models
│       ├── hud.js             # Deployed HUD + B-key field armory
│       └── theme.js           # Canvas/runtime palette + WEAPON_VISUALS silhouettes
├── assets/
│   └── maps/               # Static reference levels (de_dust.json, de_warehouse.json, level1/2.txt)
├── tests/                  # Node test runner suites (one *.test.js per module)
├── docs/superpowers/       # Design specs and implementation plans
├── DESIGN.md               # Full architecture + extension guide
├── play.sh                 # Convenience: python3 -m http.server 4173
└── package.json
```

## Architecture

The codebase follows a deliberate **pure / runtime split**:

- **Pure modules** (`js/maps/*`, `js/profile/profile.js`, `js/weapons/weapons.js`, `js/ui/theme.js`, `js/ui/operations-hub.js` view models) are deterministic, side-effect-free, and fully unit-tested. Given the same inputs they always return the same outputs.
- **Runtime modules** (`js/engine/*`, `js/ui/hud.js`, `js/ui/operations-hub.js` controller) own DOM, Canvas, audio, input, and the animation loop. They compose the pure modules.
- **`js/main.js`** is the only file that wires browser and storage dependencies together. One input handler, one renderer, one HUD, one feedback controller, one `requestAnimationFrame` chain for the entire app lifetime.

### Session lifecycle

`js/engine/session.js` owns the `hub` ↔ `combat` phase machine. Each deployment increments a monotonic deployment ID so stale round callbacks cannot revive an older run. Returning to the hub invalidates the deployment, exits pointer lock, hides combat UI, and refreshes the operations hub. Redeployment reuses the long-lived runtime but creates a fresh run.

### Map pipeline

1. `catalog.js` — frozen immutable metadata (id, series, name, callout, difficulty, seed, dimensions, variant fields).
2. `generator.js` — converts one definition into a deterministic integer grid via a project-local seeded PRNG. `Math.random()` is never used; a catalog entry's seed and variant always reproduce the same layout.
3. `validator.js` — rejects malformed or unsafe output. Checks rectangular dimensions, legal tiles, closed wall boundaries, required player/enemy/target tiles, spawn adjacency, reachability from the player spawn, and a passable-area budget.

Tiles: `0` floor · `1`–`4` wall materials · `5`/`6` targets A/B · `7` player spawn · `8` enemy spawn.

### Weapon pipeline

`js/weapons/weapons.js` owns the ordered 12-weapon combat/store catalog. Each record carries stable identity, display metadata, `unlockPrice`, combat tuning (damage, fire rate, magazine, reload, spread, recoil), and a five-axis display stat model for hub cards. `js/ui/theme.js` exposes a dedicated first-person silhouette (`WEAPON_VISUALS`) per weapon — no shared fallback geometry.

`tryFire()` returns a primary `hit` plus all `hits`. Ordinary weapons trace one ray. Shotguns declare `pellets` and `pelletSpread`; one trigger pull consumes one shell, advances recoil/cooldown once, but traces every pellet. Pellet hits are grouped by entity before aggregate damage is applied.

### Profile & economy

Storage key: `pixstrike.profile.v1`. The schema is `{ version, credits, ownedWeaponIds, equippedWeaponIds (1–4), selectedMapId, highestWaveByMap, totalKills }`. `js/profile/profile.js` owns defaults, normalization, and immutable domain actions — at least one weapon must remain equipped, no more than four, and only owned catalog IDs are retained. Kill rewards are +40 credits; wave completion is +450. `js/profile/storage.js` is the only `localStorage` boundary and swallows storage failures so the player can always keep playing.

## Getting started

### Prerequisites

- **Node.js ≥ 18** (for the test runner)
- **pnpm ≥ 11** (or any static file server)
- A modern browser with Canvas 2D + ES Modules + Pointer Lock support

### Install

```sh
pnpm install
```

The lockfile is committed (`pnpm-lock.yaml`) and the package manager version is pinned in `package.json`.

### Run

The game is a static site. Serve `index.html` over HTTP (modules don't load from `file://`):

```sh
./play.sh                  # python3 -m http.server 4173
# or
pnpm dlx serve .           # any static server
```

Then open <http://localhost:4173>.

### Controls

| Action            | Key                          |
| ----------------- | ---------------------------- |
| Move              | `W` `A` `S` `D` / arrow keys |
| Shoot             | Left mouse (pointer lock)    |
| Aim               | Mouse                        |
| Reload            | `R`                          |
| Switch weapon 1–4 | `1` `2` `3` `4`              |
| Field armory menu | `B` (during combat)          |
| Return to hub     | `Esc` (exits pointer lock)   |

### Test

```sh
pnpm test                  # node --test tests/*.test.js
```

The suite covers combat, entities, feedback, HUD, input, maps (catalog + determinism + validator), profile actions and storage, renderer (including muzzle), round, session, sound, startup, theme, and weapons. It must finish with zero failures, skips, or todos.

Static checks (must all return clean):

```sh
find js tests -name '*.js' -print0 | xargs -0 -n1 node --check
rg -n '[❤💰⏱🛒✅🎯💀]|style=' index.html js css tests
```

## Documentation

- **[DESIGN.md](./DESIGN.md)** — full architecture and extension guide (palette authority, map/weapon/profile contracts, session lifecycle, verification contract).
- **[docs/superpowers/](./docs/superpowers/)** — design specs and implementation plans for shipped features (gunplay feedback, armory/store, tactical-industrial visual redesign).

## License

See [LICENSE](./LICENSE).
