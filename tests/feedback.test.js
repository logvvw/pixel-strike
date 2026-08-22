import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatFeedback } from '../js/engine/feedback.js';
import { getCrosshairGap } from '../js/ui/hud.js';

test('shot feedback decays with elapsed time', () => {
  const feedback = new CombatFeedback();

  feedback.onShot({ fired: true, recoil: { kick: 1 } });

  assert.ok(feedback.muzzle > 0);
  assert.equal(feedback.weaponKick, 1);
  feedback.update(0.2);
  assert.equal(feedback.muzzle, 0);
  assert.ok(feedback.weaponKick < 1);
});

test('kill feedback outranks a normal hit and reset clears it', () => {
  const feedback = new CombatFeedback();

  feedback.onHit('hit');
  feedback.onKill(true);

  assert.equal(feedback.hitMarker, 'headshot-kill');
  assert.ok(feedback.killPulse > 0);
  feedback.reset();
  assert.equal(feedback.hitMarker, null);
  assert.equal(feedback.killPulse, 0);
});

test('a non-fired result never creates muzzle feedback', () => {
  const feedback = new CombatFeedback();

  feedback.onShot({ fired: false, reason: 'cooldown' });

  assert.equal(feedback.muzzle, 0);
  assert.equal(feedback.weaponKick, 0);
});

test('crosshair gap reflects normalized weapon spread', () => {
  const weapon = { baseSpread: 0.01, currentSpread: 0.01, maxSpread: 0.11 };

  assert.equal(getCrosshairGap(weapon), 3);
  weapon.currentSpread = weapon.maxSpread;
  assert.equal(getCrosshairGap(weapon), 14);
});

test('crosshair opens immediately when the player starts moving', () => {
  const weapon = {
    baseSpread: 0.01,
    currentSpread: 0.01,
    moveSpread: 0.05,
    maxSpread: 0.11,
  };

  assert.ok(getCrosshairGap(weapon, 1) > getCrosshairGap(weapon, 0));
});
