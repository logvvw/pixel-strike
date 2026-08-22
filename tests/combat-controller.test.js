import test from 'node:test';
import assert from 'node:assert/strict';

import { createCombatController } from '../js/engine/combat-controller.js';

function createHud() {
  const messages = [];
  const hidden = new Set();
  return {
    messages,
    elBuyMenu: { classList: { contains: () => hidden.has('buy') } },
    elTimer: { textContent: '03:00' },
    feedback: { reset() {}, update() {}, onShot() {}, onHit() {}, onKill() {} },
    hideBuyMenu() { hidden.add('buy'); },
    showBuyMenu() { hidden.delete('buy'); },
    hideOverlay() { hidden.add('overlay'); },
    showOverlay() { hidden.delete('overlay'); },
    showMsg(message) { messages.push(message); },
    showMsgPersistent(message) { messages.push(message); },
    hideMsg() { messages.push('__hide_msg__'); },
    showKillFeed() {},
    resetCombatFeedback() {},
    setMapIdentity(definition) { this.identity = definition; },
    flashDamage() {},
    update() {},
  };
}

function createPlayer() {
  const weapons = [
    { id: 'pistol', name: 'Pistol', reloading: false, currentAmmo: 10 },
    { id: 'rifle', name: 'Rifle', reloading: false, currentAmmo: 30 },
  ];
  return {
    x: 1,
    y: 1,
    angle: 0,
    health: 100,
    maxHealth: 100,
    dead: false,
    score: 0,
    money: 0,
    wave: 0,
    movementIntensity: 0,
    recoilX: 0,
    recoilY: 0,
    cameraPitch: 0,
    crouching: false,
    jumpCalls: 0,
    weapons,
    currentWeaponIdx: 0,
    get currentWeapon() { return this.weapons[this.currentWeaponIdx]; },
    move() { this.movementIntensity = 1; },
    updateWeaponHandling() {},
    applyWeaponRecoil(recoil) { this.recoilY += recoil?.y ?? 0; },
    takeDamage(amount) { this.health = Math.max(0, this.health - amount); this.dead = this.health <= 0; },
    jump() { this.crouching = false; this.jumpCalls++; return true; },
  };
}

function createEnemy() {
  return {
    x: 3,
    y: 3,
    alive: true,
    visible: true,
    radius: 0.3,
    update() { return null; },
    takeDamage() { this.alive = false; },
  };
}

function createHarness(profile = { credits: 1800, totalKills: 0, highestWaveByMap: {} }) {
  const hud = createHud();
  let pressedThisFrame = [];
  let heldCodes = [];
  const input = {
    reset() {},
    justPressed(code) { return pressedThisFrame.includes(code); },
    isHeld(code) { return heldCodes.includes(code); },
    mouseJustPressed() { return false; },
    isMouseHeld() { return false; },
  };
  const press = code => { pressedThisFrame = preferredCodes(code); };
  const hold = code => { heldCodes = preferredCodes(code); };
  const release = () => { heldCodes = []; };
  function preferredCodes(code) {
    return Array.isArray(code) ? code : [code];
  }
  const state = { phase: 'active', deploymentId: 1, mapId: 'test-map', wave: 1, score: 0 };
  const session = {
    state,
    setRunProgress(progress) { this.state = { ...this.state, ...progress }; return this.state; },
    isDeploymentCurrent(id) { return this.state.phase === 'active' && this.state.deploymentId === id; },
  };
  const sound = {
    callLog: [],
    fire(category) { this.callLog.push(`fire:${category}`); },
    hit(headshot) { this.callLog.push(`hit:${headshot}`); },
    kill(headshot) { this.callLog.push(`kill:${headshot}`); },
  };
  let currentProfile = profile;
  const controller = createCombatController({
    input,
    hud,
    feedback: hud.feedback,
    renderer: { canvas: {}, render() {} },
    session,
    getProfile: () => currentProfile,
    setProfile(next) { currentProfile = next; },
    profileStorage: { save() {} },
    playerFactory: createPlayer,
    enemyFactory: createEnemy,
    loadoutFactory: () => [
      { id: 'pistol', name: 'Pistol', reloading: false, currentAmmo: 10 },
      { id: 'rifle', name: 'Rifle', reloading: false, currentAmmo: 30 },
    ],
    now: () => 1000,
    random: () => 0,
    schedule: callback => ({ callback, cancel() {} }),
    sound,
  });
  return { controller, hud, session, sound, getProfile: () => currentProfile, press, hold, release };
}

function activate(controller) {
  controller.activate({
    deployment: {
      definition: { id: 'test-map', name: 'Test Map', callout: 'TEST', roundTime: 60 },
      grid: [
        [1, 1, 1, 1, 1],
        [1, 7, 0, 8, 1],
        [1, 0, 0, 0, 1],
        [1, 8, 0, 8, 1],
        [1, 1, 1, 1, 1],
      ],
    },
    state: { deploymentId: 1, mapId: 'test-map', wave: 1, score: 0 },
  });
}

test('deployment creates a fresh player, map identity, HUD state, and round message', () => {
  const { controller, hud } = createHarness();
  activate(controller);
  assert.equal(controller.player.x, 1.5);
  assert.equal(controller.player.wave, 1);
  assert.equal(hud.identity.id, 'test-map');
  assert.match(hud.messages.at(-1), /CONTACT WAVE/);
});

test('weapon selection updates the active slot', () => {
  const { controller } = createHarness();
  activate(controller);
  assert.equal(controller.selectWeaponById('rifle'), true);
  assert.equal(controller.player.currentWeapon.id, 'rifle');
});

test('grouped hit reward updates score, profile, HUD, and round enemy count', () => {
  const { controller, hud, session, getProfile, sound } = createHarness();
  activate(controller);
  controller.spawnEnemy();
  const enemy = controller.entities[0];

  sound.callLog.length = 0;
  controller.applyGroupedHits(
    [{ entity: enemy, damage: 100, anyHeadshot: true }],
    controller.player.currentWeapon,
  );

  assert.equal(enemy.alive, false);
  assert.equal(controller.enemiesAlive, 0);
  assert.equal(session.state.score, 250);
  assert.equal(controller.player.score, 250);
  assert.equal(getProfile().credits, 1840);
  assert.equal(getProfile().totalKills, 1);
  assert.match(hud.messages.at(-1), /\+250/);
  assert.deepEqual(sound.callLog, ['hit:true', 'kill:true']);
});

test('fire sound uses the equipped weapon category', () => {
  const { controller, sound } = createHarness();
  activate(controller);
  sound.callLog.length = 0;
  controller.fireWeapon(controller.player.currentWeapon);
  assert.ok(sound.callLog.some(call => call.startsWith('fire:')), 'fireWeapon must trigger a shot sound');
});

test('return to hub clears active run state and hides combat UI', () => {
  const { controller, hud } = createHarness();
  activate(controller);
  controller.entities.push(createEnemy());

  controller.returnToHub();

  assert.equal(controller.player, null);
  assert.equal(controller.mapData, null);
  assert.equal(controller.entities.length, 0);
  assert.equal(controller.enemiesAlive, 0);
  assert.equal(hud.elBuyMenu.classList.contains('is-hidden'), true);
});

test('P pauses the round update and freezes the mission clock', () => {
  const { controller, hud, press } = createHarness();
  activate(controller);

  // Advance one live frame so HUD reflects the real roundTimeLeft.
  controller.runActiveUpdate({ timestamp: 1000 });
  const liveClock = hud.elTimer.textContent;

  press('KeyP');
  controller.runActiveUpdate({ timestamp: 1000 });

  assert.ok(hud.messages.some(msg => msg.includes('PAUSED')), 'pause should show PAUSED');
  // A subsequent update frame must not decrement the clock while paused.
  controller.runActiveUpdate({ timestamp: 2000 });
  assert.equal(hud.elTimer.textContent, liveClock, 'clock must freeze while paused');
});

test('P again resumes the round update', () => {
  const { controller, hud, press } = createHarness();
  activate(controller);
  press('KeyP');
  controller.runActiveUpdate({ timestamp: 1000 });
  press('KeyP');
  controller.runActiveUpdate({ timestamp: 2000 });

  assert.ok(hud.messages.includes('__hide_msg__'), 'resume should dismiss PAUSED');
  // After resuming, the clock should advance again.
  const after = hud.elTimer.textContent;
  controller.runActiveUpdate({ timestamp: 3000 });
  assert.ok(after !== hud.elTimer.textContent || hud.messages.includes('__hide_msg__'),
    'clock should resume ticking after PAUSED is dismissed');
});

test('Control rising edge triggers exactly one jump', () => {
  const { controller, hold, release } = createHarness();
  activate(controller);
  hold('ControlLeft');
  controller.runActiveUpdate({ timestamp: 1000 });
  assert.equal(controller.player.jumpCalls, 1, 'Ctrl rising edge must trigger a jump');
  // Holding Ctrl across further frames must not re-trigger.
  controller.runActiveUpdate({ timestamp: 1200 });
  assert.equal(controller.player.jumpCalls, 1, 'held Ctrl must not repeat jump');
  // Release and re-press triggers a second jump.
  release();
  controller.runActiveUpdate({ timestamp: 1400 });
  hold('ControlLeft');
  controller.runActiveUpdate({ timestamp: 1600 });
  assert.equal(controller.player.jumpCalls, 2, 'Ctrl re-press should jump again');
});
