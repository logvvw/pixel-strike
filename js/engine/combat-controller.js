import { extractMetadata } from './map.js';
import { findWeaponIndexById, groupHitsByEntity } from './session.js';
import { RoundGate } from './round.js';
import { createLoadoutFromProfile } from '../profile/actions.js';
import { awardKill, awardWave } from '../profile/profile.js';
import { createWeapon, reloadWeapon, tryFire, updateReload, updateWeaponHandling } from '../weapons/weapons.js';
import { UI_COPY, WEAPON_VISUALS } from '../ui/theme.js';

const DEFAULT_MAX_FRAME_DELTA = 0.05;
const ENEMY_BASE_HEALTH = 35;
const ENEMY_HEALTH_PER_WAVE = 5;
const ENEMY_SPAWN_INTERVAL = 1.5;
const WAVE_CLEAR_DELAY_MS = 2000;
const TIMEOUT_DELAY_MS = 2500;
const BASE_ENEMIES_PER_WAVE = 2;

function toFiniteNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function formatTimer(seconds) {
  const safeSeconds = Math.max(0, Math.ceil(toFiniteNumber(seconds)));
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

function weaponSoundProfile(weaponId) {
  const visual = WEAPON_VISUALS[weaponId];
  if (!visual) return 'rifle';
  return visual.profile ?? 'rifle';
}

export function createCombatController({
  input,
  hud,
  feedback,
  renderer,
  session,
  getProfile,
  setProfile,
  profileStorage,
  playerFactory,
  enemyFactory,
  loadoutFactory = createLoadoutFromProfile,
  weaponFactory = createWeapon,
  now = () => performance.now(),
  random = Math.random,
  schedule = setTimeout,
  requestPointerLock = null,
  exitPointerLock = null,
  maxFrameDelta = DEFAULT_MAX_FRAME_DELTA,
  sound = null,
}) {
  if (!input || !hud || !feedback || !renderer || !session) {
    throw new Error('combat controller requires input, HUD, feedback, renderer, and session dependencies');
  }
  if (typeof getProfile !== 'function' || typeof setProfile !== 'function') {
    throw new Error('combat controller requires profile getters and setters');
  }

  const playShotSound = (weapon) => {
    if (!sound) return;
    sound.fire(weaponSoundProfile(weapon?.id));
  };
  const playHitSound = isHeadshot => {
    if (!sound) return;
    sound.hit(Boolean(isHeadshot));
  };
  const playKillSound = isHeadshot => {
    if (!sound) return;
    sound.kill(Boolean(isHeadshot));
  };

  const gate = new RoundGate();
  let lastTime = now();
  let roundRestartHandle = null;
  let prevCtrlHeld = false;

  const state = {
    player: null,
    mapData: null,
    mapMeta: null,
    selectedDefinition: null,
    entities: [],
    spawnTimer: 0,
    enemiesAlive: 0,
    totalEnemiesSpawned: 0,
    enemiesPerWave: BASE_ENEMIES_PER_WAVE,
    roundTimeLeft: 0,
    paused: false,
  };

  function clearRoundRestart() {
    if (roundRestartHandle === null) return;
    if (typeof roundRestartHandle.cancel === 'function') roundRestartHandle.cancel();
    else clearTimeout(roundRestartHandle);
    roundRestartHandle = null;
  }

  function activate({ state: sessionState, deployment }) {
    const { definition, grid } = deployment ?? {};
    if (!definition || !Array.isArray(grid)) throw new Error('invalid combat deployment');

    clearRoundRestart();
    gate.reset();
    const extracted = extractMetadata(grid);
    const mapMeta = {
      ...extracted,
      id: definition.id,
      name: definition.name,
      callout: definition.callout,
      roundTime: definition.roundTime,
    };
    const spawn = mapMeta.ctSpawns[0];
    if (!spawn) throw new Error('map has no player spawn');

    const profile = getProfile();
    state.selectedDefinition = definition;
    state.mapData = grid;
    state.mapMeta = mapMeta;
    state.player = playerFactory(spawn.x, spawn.y, Math.PI / 2);
    state.player.angle = Math.PI / 2;
    state.player.money = profile.credits;
    state.player.score = sessionState.score;
    state.player.wave = sessionState.wave;
    state.player.weapons = loadoutFactory(profile, weaponFactory);
    state.player.currentWeaponIdx = 0;
    state.entities = [];
    state.enemiesAlive = 0;
    state.totalEnemiesSpawned = 0;
    state.spawnTimer = 0;
    state.roundTimeLeft = definition.roundTime;
    state.paused = false;
    prevCtrlHeld = false;

    input.reset();
    hud.setMapIdentity(definition);
    hud.hideOverlay();
    hud.hideBuyMenu();
    feedback.reset();
    lastTime = now();
    startRound();
    requestPointerLock?.(renderer.canvas);
  }

  function startRound() {
    const currentSession = session.state;
    clearRoundRestart();
    gate.reset();
    state.entities = [];
    state.enemiesAlive = 0;
    state.totalEnemiesSpawned = 0;
    state.spawnTimer = 0;
    state.roundTimeLeft = state.mapMeta.roundTime;
    state.enemiesPerWave = BASE_ENEMIES_PER_WAVE + currentSession.wave;

    const spawn = state.mapMeta.ctSpawns[0];
    state.player.x = spawn.x;
    state.player.y = spawn.y;
    state.player.health = state.player.maxHealth;
    state.player.dead = false;
    state.player.wave = currentSession.wave;
    state.player.score = currentSession.score;
    state.player.movementIntensity = 0;
    state.player.recoilX = 0;
    state.player.recoilY = 0;
    state.player.cameraPitch = 0;

    input.reset();
    feedback.reset();
    hud.hideOverlay();
    hud.resetCombatFeedback();
    hud.showMsg(`CONTACT WAVE // ${String(currentSession.wave).padStart(2, '0')}`);
    hud.hideBuyMenu();
  }

  function spawnEnemy() {
    const spawns = state.mapMeta.tSpawns;
    if (!Array.isArray(spawns) || spawns.length === 0) return;
    const spawn = spawns[Math.floor(random() * spawns.length)];
    const enemy = enemyFactory(spawn.x, spawn.y, 'enemy');
    enemy.health = ENEMY_BASE_HEALTH + session.state.wave * ENEMY_HEALTH_PER_WAVE;
    enemy.maxHealth = enemy.health;
    state.entities.push(enemy);
    state.enemiesAlive++;
    state.totalEnemiesSpawned++;
  }

  function update(dt, currentTime) {
    handleActionInput(currentTime);
    state.player.move(dt, input, state.mapData);

    const weapon = state.player.currentWeapon;
    const buyMenuOpen = hud.elBuyMenu && !hud.elBuyMenu.classList.contains('is-hidden');
    const pressed = input.justPressed('Space') || input.mouseJustPressed(0);
    const held = input.isHeld('Space') || input.isMouseHeld(0);
    if (weapon && !buyMenuOpen && (pressed || (weapon.auto && held))) fireWeapon(weapon);

    if (weapon?.reloading) updateReload(weapon, currentTime);
    for (const carriedWeapon of state.player.weapons) updateWeaponHandling(carriedWeapon, dt, currentTime);

    for (const entity of state.entities) {
      const result = entity.update(dt, state.player, state.mapData);
      if (result?.type === 'attack') {
        state.player.takeDamage(result.damage);
        hud.flashDamage();
      }
    }

    if (state.player.dead) {
      handleDeath();
      return;
    }

    if (state.enemiesAlive < state.enemiesPerWave && state.totalEnemiesSpawned < state.enemiesPerWave) {
      state.spawnTimer += dt;
      if (state.spawnTimer > ENEMY_SPAWN_INTERVAL) {
        state.spawnTimer = 0;
        spawnEnemy();
      }
    }

    if (state.enemiesAlive <= 0 && state.totalEnemiesSpawned >= state.enemiesPerWave) {
      completeWave();
      return;
    }

    state.roundTimeLeft -= dt;
    if (state.roundTimeLeft <= 0) {
      state.roundTimeLeft = 0;
      hud.elTimer.textContent = '00:00';
      const token = gate.claim('timeout');
      if (token) {
        hud.showMsg('MISSION CLOCK EXPIRED');
        scheduleRoundRestart(token, TIMEOUT_DELAY_MS);
      }
      return;
    }
    hud.elTimer.textContent = formatTimer(state.roundTimeLeft);
  }

  function completeWave() {
    const token = gate.claim('win');
    if (!token) return;
    const completedWave = session.state.wave;
    const nextProfile = awardWave(getProfile(), session.state.mapId, completedWave);
    setProfile(nextProfile);
    profileStorage.save(nextProfile);
    state.player.money = nextProfile.credits;

    const nextWave = completedWave + 1;
    const nextSession = session.setRunProgress({
      wave: nextWave,
      score: session.state.score + 100 * nextWave,
    });
    state.player.wave = nextSession.wave;
    state.player.score = nextSession.score;
    hud.showMsg(`SECTOR CLEAR // WAVE ${completedWave} // +$450`);
    scheduleRoundRestart(token, WAVE_CLEAR_DELAY_MS);
  }

  function scheduleRoundRestart(token, delay) {
    clearRoundRestart();
    const deploymentId = session.state.deploymentId;
    const callback = () => {
      roundRestartHandle = null;
      if (gate.isCurrent(token) && session.isDeploymentCurrent(deploymentId)) startRound();
    };
    roundRestartHandle = schedule(callback, delay);
  }

  function handleDeath() {
    if (!gate.claim('death')) return;
    feedback.reset();
    input.reset();
    hud.showOverlay(
      'OPERATOR DOWN',
      `分数: ${state.player.score}  |  波次: ${session.state.wave}`,
      '重新部署',
      () => session.redeploy?.(),
      { label: '返回作战中心', onClick: () => session.returnToOperations?.() },
    );
  }

  function fireWeapon(weapon) {
    const shot = tryFire(weapon, state.player, state.entities, state.mapData, now());
    if (!shot.fired) return;
    state.player.applyWeaponRecoil(shot.recoil);
    feedback.onShot(shot);
    playShotSound(weapon);
    const hits = Array.isArray(shot.hits) ? shot.hits : (shot.hit ? [shot.hit] : []);
    applyGroupedHits(groupHitsByEntity(hits), weapon);
  }

  function applyGroupedHits(groups, weapon) {
    if (groups.length === 0) return;
    const triggerHeadshot = groups.some(group => group.anyHeadshot);
    feedback.onHit(triggerHeadshot ? 'headshot' : 'hit');
    playHitSound(triggerHeadshot);

    for (const group of groups) {
      const enemy = group.entity;
      const wasAlive = enemy.alive;
      enemy.takeDamage(group.damage);
      if (!wasAlive || enemy.alive) continue;

      state.enemiesAlive--;
      const scoreAward = group.anyHeadshot ? 250 : 100;
      const nextSession = session.setRunProgress({ score: session.state.score + scoreAward });
      state.player.score = nextSession.score;
      const nextProfile = awardKill(getProfile());
      setProfile(nextProfile);
      profileStorage.save(nextProfile);
      state.player.money = nextProfile.credits;
      feedback.onKill(group.anyHeadshot);
      playKillSound(group.anyHeadshot);
      hud.showKillFeed(weapon.name, group.anyHeadshot);
      hud.showMsg(group.anyHeadshot
        ? `${UI_COPY.headshot} // +${scoreAward}`
        : `${UI_COPY.eliminated} // +${scoreAward}`);
    }
  }

  function selectWeapon(index) {
    if (!state.player || index < 0 || index >= state.player.weapons.length) return false;
    state.player.currentWeaponIdx = index;
    feedback.reset();
    if (hud?._renderBuyList && hud.elBuyMenu && !hud.elBuyMenu.classList.contains('is-hidden')) {
      hud._renderBuyList(state.player);
    }
    return true;
  }

  function selectWeaponById(id) {
    return selectWeapon(findWeaponIndexById(state.player?.weapons, id));
  }

  function handleActionInput(currentTime) {
    if (!state.player || state.player.dead) return;
    if (input.justPressed('KeyB')) {
      if (hud.elBuyMenu && !hud.elBuyMenu.classList.contains('is-hidden')) hud.hideBuyMenu();
      else {
        feedback.reset();
        hud.showBuyMenu(state.player);
      }
      return;
    }
    if (input.justPressed('Digit1')) selectWeapon(0);
    else if (input.justPressed('Digit2')) selectWeapon(1);
    else if (input.justPressed('Digit3')) selectWeapon(2);
    else if (input.justPressed('Digit4')) selectWeapon(3);
    if (input.justPressed('KeyR')) {
      const weapon = state.player.currentWeapon;
      if (weapon) reloadWeapon(weapon, state.player, currentTime);
    }
    // Jump fires on the rising edge of Ctrl. We detect with isHeld (not
    // justPressed) because modifier-key keyup/keydown edge events are
    // unreliable across real browsers — justPressed can re-fire or stall on
    // Ctrl, which froze the game. isHeld + an edge flag fires exactly once
    // per press and is immune to a stuck modifier key.
    const ctrlHeld = input.isHeld('ControlLeft') || input.isHeld('ControlRight');
    if (ctrlHeld && !prevCtrlHeld) {
      state.player.jump();
    }
    prevCtrlHeld = ctrlHeld;
  }

  function togglePause() {
    state.paused = !state.paused;
    if (state.paused) {
      hud.showMsgPersistent('PAUSED // P 继续');
    } else {
      hud.hideMsg();
    }
  }

  function runActiveUpdate({ timestamp }) {
    const currentTime = toFiniteNumber(timestamp, now());
    const dt = Math.min(maxFrameDelta, Math.max(0, (currentTime - lastTime) / 1000));
    lastTime = currentTime;

    if (input.justPressed('KeyP')) {
      togglePause();
      if (state.paused) return;
    }
    if (state.paused) return;

    feedback.update(dt);
    state.player.updateWeaponHandling(dt);
    if (!gate.pending) update(dt, currentTime);
  }

  function runActiveRender() {
    render();
    hud.update(state.player, feedback);
  }

  function render() {
    renderer.render(state.player, state.mapData, state.entities, feedback);
  }

  function returnToHub() {
    clearRoundRestart();
    gate.reset();
    feedback.reset();
    input.reset();
    state.entities = [];
    state.enemiesAlive = 0;
    state.totalEnemiesSpawned = 0;
    state.spawnTimer = 0;
    state.player = null;
    state.mapData = null;
    state.mapMeta = null;
    state.selectedDefinition = null;
    state.paused = false;
    hud.hideOverlay();
    hud.hideBuyMenu();
    exitPointerLock?.();
  }

  return {
    activate,
    applyGroupedHits,
    clearRoundRestart,
    fireWeapon,
    get enemiesAlive() { return state.enemiesAlive; },
    get entities() { return state.entities; },
    get mapData() { return state.mapData; },
    get player() { return state.player; },
    get paused() { return state.paused; },
    get roundTimeLeft() { return state.roundTimeLeft; },
    get totalEnemiesSpawned() { return state.totalEnemiesSpawned; },
    render,
    returnToHub,
    runActiveRender,
    runActiveUpdate,
    selectWeaponById,
    spawnEnemy,
    startRound,
    update,
  };
}
