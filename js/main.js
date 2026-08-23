/**
 * main.js — PixStrike composition root.
 *
 * Session lifetime lives in RuntimeSessionController; active combat state and
 * update order live in CombatController. The SoundEngine is lazily armed from
 * a trusted user gesture (deploy / pointer lock). This file only wires
 * browser and storage dependencies together.
 */
import { InputHandler } from './engine/input.js';
import { Renderer } from './engine/renderer.js';
import { Player } from './engine/player.js';
import { Entity } from './engine/entity.js';
import { CombatFeedback } from './engine/feedback.js';
import { createRuntimeSessionController } from './engine/session.js';
import { createCombatController } from './engine/combat-controller.js';
import { SoundEngine } from './engine/sound.js';
import { createLoadoutFromProfile, createProfileActionController } from './profile/actions.js';
import { createProfileStorage } from './profile/storage.js';
import { HUD } from './ui/hud.js';
import { getProfileActionStatus, OperationsHub } from './ui/operations-hub.js';
import { getMapDefinition } from './maps/catalog.js';
import { generateMap } from './maps/generator.js';
import { validateGeneratedMap } from './maps/validator.js';
import { createWeapon } from './weapons/weapons.js';

let canvas = null;
let input = null;
let renderer = null;
let hud = null;
let feedback = null;
let combatController = null;
let gameLoopId = null;
let runtimeController = null;
let profile = null;
let hub = null;
let sound = null;

function getAvailableLocalStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const profileStorage = createProfileStorage(getAvailableLocalStorage());
profile = profileStorage.load();

const profileActions = createProfileActionController({
  getProfile: () => profile,
  setProfile(nextProfile) {
    profile = nextProfile;
  },
  storage: profileStorage,
  hub: {
    refresh(nextProfile) {
      hub.refresh(nextProfile);
    },
    setStatus(message, tone) {
      hub.setStatus(message, tone);
    },
  },
  getActionStatus: getProfileActionStatus,
});

// SoundEngine is created at module load so UI ticks can play during the hub
// phase (map selection). The first user click on a map card counts as the
// user activation autoplay policies require, so arm() is safe to call here.
sound = new SoundEngine();
sound.arm();

function createRuntimeBase() {
  const runtimeCanvas = document.getElementById('game-canvas');
  if (!runtimeCanvas) throw new Error('游戏画布不可用');
  return {
    canvas: runtimeCanvas,
    renderer: new Renderer(runtimeCanvas),
    hud: new HUD(),
    feedback: new CombatFeedback(),
  };
}

function completeRuntime({ runtimeBase, input: runtimeInput }) {
  ({ canvas, renderer, hud, feedback } = runtimeBase);
  input = runtimeInput;
  input.lockPointer(canvas);

  sound.arm();
  sound.resume();

  combatController = createCombatController({
    input,
    hud,
    feedback,
    renderer,
    session: runtimeController,
    getProfile: () => profile,
    setProfile(nextProfile) {
      profile = nextProfile;
    },
    profileStorage,
    playerFactory: (x, y, angle) => new Player(x, y, angle),
    enemyFactory: (x, y, type) => new Entity(x, y, type),
    loadoutFactory: createLoadoutFromProfile,
    weaponFactory: createWeapon,
    now: () => performance.now(),
    requestPointerLock: canvasElement => {
      try {
        const request = canvasElement?.requestPointerLock?.();
        request?.catch?.(() => {});
      } catch {
        // Pointer lock is optional; keyboard controls remain available.
      }
    },
    exitPointerLock: () => document.exitPointerLock?.(),
    sound,
  });

  window.__pixstrike_game = {
    selectWeaponById: combatController.selectWeaponById,
    deployOperation,
    returnToOperations,
  };
  return { canvas, input, renderer, hud, feedback };
}

function resolveGeneratedMap(mapId) {
  const definition = getMapDefinition(mapId);
  if (!definition || definition.id !== mapId) {
    return { ok: false, message: '所选地图不存在' };
  }
  try {
    const grid = generateMap(definition);
    const validation = validateGeneratedMap(grid, definition);
    if (!validation.valid) {
      return { ok: false, message: `地图验证失败：${validation.errors[0] ?? '未知错误'}` };
    }
    return { ok: true, definition, grid };
  } catch (error) {
    return { ok: false, message: `地图生成失败：${error.message}` };
  }
}

function activateOperation({ state, deployment }) {
  combatController.activate({ state, deployment });
  hub.hide();
  document.getElementById('boot-screen')?.classList.add('is-hidden');
  document.getElementById('game-container')?.classList.remove('is-hidden');
}

function resetReturnedOperation() {
  combatController.returnToHub();
  document.getElementById('game-container')?.classList.add('is-hidden');
  hub.show(profile);
}

function deployOperation(mapId) {
  try {
    const result = runtimeController.deploy(mapId);
    if (!result.ok) hub.setStatus(result.message, 'error');
    return result.ok;
  } catch (error) {
    hub.setStatus(`运行时初始化失败：${error.message}`, 'error');
    return false;
  }
}

function returnToOperations() {
  runtimeController.returnToOperations();
}

runtimeController = createRuntimeSessionController({
  resolveDeployment: resolveGeneratedMap,
  createRuntimeBase,
  createInput: () => new InputHandler(),
  completeRuntime,
  requestFrame(callback) {
    gameLoopId = requestAnimationFrame(callback);
    return gameLoopId;
  },
  onActiveUpdate: context => combatController.runActiveUpdate(context),
  onActiveRender: () => combatController.runActiveRender(),
  onDeploy: activateOperation,
  onReturn: resetReturnedOperation,
});

hub = new OperationsHub({
  onDeploy: deployOperation,
  sound,
  ...profileActions,
});
hub.show(profile);
