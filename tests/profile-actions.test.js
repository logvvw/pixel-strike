import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createLoadoutFromProfile,
  createProfileActionController,
} from '../js/profile/actions.js';
import { createDefaultProfile } from '../js/profile/profile.js';
import { getProfileActionStatus } from '../js/ui/operations-hub.js';
import { createWeapon } from '../js/weapons/weapons.js';

function createHarness({
  initialProfile = createDefaultProfile(),
  saveResult = true,
} = {}) {
  const state = {
    profile: initialProfile,
    activePlayer: {
      weapons: [{ id: 'pistol', ammo: 9 }],
      currentWeaponIdx: 0,
    },
  };
  const calls = [];
  const controller = createProfileActionController({
    getProfile: () => state.profile,
    setProfile(nextProfile) {
      state.profile = nextProfile;
      calls.push({ type: 'set-profile', profile: nextProfile });
    },
    storage: {
      save(nextProfile) {
        calls.push({
          type: 'save',
          profile: nextProfile,
          visibleProfile: state.profile,
        });
        return saveResult;
      },
    },
    hub: {
      refresh(nextProfile) {
        calls.push({ type: 'refresh', profile: nextProfile });
      },
      setStatus(message, tone) {
        calls.push({ type: 'status', message, tone });
      },
    },
    getActionStatus: getProfileActionStatus,
  });

  return {
    calls,
    controller,
    state,
  };
}

test('successful profile actions assign memory before save, refresh, and status in exact order', () => {
  const harness = createHarness();

  assert.equal(harness.controller.onPurchase('usp'), true);

  const nextProfile = harness.state.profile;
  assert.equal(nextProfile.credits, 1400);
  assert.deepEqual(nextProfile.ownedWeaponIds, ['pistol', 'usp']);
  assert.deepEqual(harness.calls.map(call => call.type), [
    'set-profile',
    'save',
    'refresh',
    'status',
  ]);
  assert.equal(harness.calls[0].profile, nextProfile);
  assert.equal(harness.calls[1].visibleProfile, nextProfile);
  assert.equal(harness.calls[1].profile, nextProfile);
  assert.equal(harness.calls[2].profile, nextProfile);
  assert.deepEqual(harness.calls[3], {
    type: 'status',
    message: '已解锁 USP-S',
    tone: 'success',
  });
});

test('failed storage retains the accepted in-memory profile and reports the save warning last', () => {
  const harness = createHarness({ saveResult: false });

  assert.equal(harness.controller.onPurchase('usp'), true);

  assert.equal(harness.state.profile.credits, 1400);
  assert.deepEqual(harness.state.profile.ownedWeaponIds, ['pistol', 'usp']);
  assert.deepEqual(harness.calls.map(call => call.type), [
    'set-profile',
    'save',
    'refresh',
    'status',
  ]);
  assert.equal(harness.calls[1].visibleProfile, harness.state.profile);
  assert.equal(harness.calls[2].profile, harness.state.profile);
  assert.deepEqual(harness.calls[3], {
    type: 'status',
    message: '进度已更新，但本次可能无法保存',
    tone: 'warning',
  });
});

test('rejected actions preserve the profile reference and skip save and refresh', () => {
  const initialProfile = {
    ...createDefaultProfile(),
    credits: 0,
  };
  const harness = createHarness({ initialProfile });

  assert.equal(harness.controller.onPurchase('usp'), false);

  assert.equal(harness.state.profile, initialProfile);
  assert.deepEqual(harness.calls, [{
    type: 'status',
    message: '军械点数不足',
    tone: 'warning',
  }]);
});

test('purchase, equip, and map callbacks leave an active player instance untouched', () => {
  const harness = createHarness();
  const activePlayer = harness.state.activePlayer;
  const activeWeapons = activePlayer.weapons;
  const before = structuredClone(activePlayer);

  assert.equal(harness.controller.onPurchase('usp'), true);
  assert.equal(harness.controller.onToggleEquip('usp'), true);
  assert.equal(harness.controller.onSelectMap('plaza-fountain'), true);

  assert.deepEqual(harness.state.profile.ownedWeaponIds, ['pistol', 'usp']);
  assert.deepEqual(harness.state.profile.equippedWeaponIds, ['pistol', 'usp']);
  assert.equal(harness.state.profile.selectedMapId, 'plaza-fountain');
  assert.equal(harness.state.activePlayer, activePlayer);
  assert.equal(harness.state.activePlayer.weapons, activeWeapons);
  assert.deepEqual(harness.state.activePlayer, before);
});

test('purchase then equip produces fresh next-deployment weapons in exact profile order', () => {
  const harness = createHarness();
  assert.equal(harness.controller.onPurchase('usp'), true);
  assert.equal(harness.controller.onToggleEquip('usp'), true);

  const firstLoadout = createLoadoutFromProfile(harness.state.profile, createWeapon);
  const secondLoadout = createLoadoutFromProfile(harness.state.profile, createWeapon);

  assert.deepEqual(harness.state.profile.equippedWeaponIds, ['pistol', 'usp']);
  assert.deepEqual(firstLoadout.map(weapon => weapon.id), ['pistol', 'usp']);
  assert.deepEqual(secondLoadout.map(weapon => weapon.id), ['pistol', 'usp']);
  assert.notEqual(firstLoadout[0], secondLoadout[0]);
  assert.notEqual(firstLoadout[1], secondLoadout[1]);
});

test('loadout creation never passes unknown equipped IDs to the weapon factory', () => {
  const requestedIds = [];
  const profile = {
    ...createDefaultProfile(),
    equippedWeaponIds: ['usp', 'missing', 'pistol'],
  };

  const loadout = createLoadoutFromProfile(profile, id => {
    requestedIds.push(id);
    return { id };
  });

  assert.deepEqual(requestedIds, ['usp', 'pistol']);
  assert.deepEqual(loadout, [{ id: 'usp' }, { id: 'pistol' }]);
});
