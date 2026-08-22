import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROFILE_VERSION,
  PROFILE_KEY,
  createDefaultProfile,
  normalizeProfile,
  purchaseWeapon,
  toggleEquippedWeapon,
  selectProfileMap,
  awardKill,
  awardWave,
} from '../js/profile/profile.js';
import { createProfileStorage } from '../js/profile/storage.js';

const catalogs = {
  weapons: {
    pistol: { id: 'pistol', unlockPrice: 0 },
    uzi: { id: 'uzi', unlockPrice: 1100 },
    ak47: { id: 'ak47', unlockPrice: 3000 },
    awp: { id: 'awp', unlockPrice: 4200 },
    usp: { id: 'usp', unlockPrice: 400 },
  },
  maps: [
    { id: 'ship-deck' },
    { id: 'plaza-fountain' },
  ],
};

test('default profile starts the approved operation with independently owned nested data', () => {
  const first = createDefaultProfile();
  const second = createDefaultProfile();

  assert.deepEqual(first, {
    version: PROFILE_VERSION,
    credits: 1800,
    ownedWeaponIds: ['pistol'],
    equippedWeaponIds: ['pistol'],
    selectedMapId: 'ship-deck',
    highestWaveByMap: {},
    totalKills: 0,
  });
  assert.notEqual(first.ownedWeaponIds, second.ownedWeaponIds);
  assert.notEqual(first.equippedWeaponIds, second.equippedWeaponIds);
  assert.notEqual(first.highestWaveByMap, second.highestWaveByMap);
});

test('normalization repairs corrupt identifiers, quantities, maps, and equipment limits', () => {
  const profile = normalizeProfile({
    version: PROFILE_VERSION,
    credits: -4,
    ownedWeaponIds: ['uzi', 'pistol', 'uzi', 'unknown', 'ak47', 'awp', 'usp'],
    equippedWeaponIds: ['unknown', 'uzi', 'uzi', 'ak47', 'awp', 'usp'],
    selectedMapId: 'missing',
    highestWaveByMap: {
      'ship-deck': 3.8,
      unknown: 99,
      'plaza-fountain': -1,
    },
    totalKills: Number.POSITIVE_INFINITY,
  }, catalogs);

  assert.equal(profile.credits, 0);
  assert.deepEqual(profile.ownedWeaponIds, ['uzi', 'pistol', 'ak47', 'awp', 'usp']);
  assert.deepEqual(profile.equippedWeaponIds, ['uzi', 'ak47', 'awp', 'usp']);
  assert.equal(profile.selectedMapId, 'ship-deck');
  assert.deepEqual(profile.highestWaveByMap, { 'ship-deck': 3, 'plaza-fountain': 0 });
  assert.equal(profile.totalKills, 0);
});

test('normalization safely falls back for malformed or wrong-version data', () => {
  for (const value of [null, [], 'profile', 12, { version: 2 }, { version: PROFILE_VERSION, equippedWeaponIds: [] }]) {
    const profile = normalizeProfile(value, catalogs);
    assert.equal(profile.version, PROFILE_VERSION);
    assert.ok(profile.ownedWeaponIds.includes('pistol'));
    assert.deepEqual(profile.equippedWeaponIds, ['pistol']);
    assert.equal(profile.selectedMapId, 'ship-deck');
  }
});

test('normalization retains default credits when a current-version profile omits them', () => {
  const profile = normalizeProfile({ version: PROFILE_VERSION }, catalogs);

  assert.equal(profile.credits, 1800);
});

test('purchase deducts the weapon unlock price once and keeps the input profile unchanged', () => {
  const profile = normalizeProfile({
    version: PROFILE_VERSION,
    credits: 1200,
    ownedWeaponIds: ['pistol'],
    equippedWeaponIds: ['pistol'],
  }, catalogs);

  const result = purchaseWeapon(profile, 'uzi', catalogs.weapons);

  assert.deepEqual(result, {
    profile: {
      ...profile,
      credits: 100,
      ownedWeaponIds: ['pistol', 'uzi'],
    },
    ok: true,
    reason: null,
  });
  assert.equal(result.profile === profile, false);
  assert.equal(result.profile.ownedWeaponIds === profile.ownedWeaponIds, false);
  assert.deepEqual(profile.ownedWeaponIds, ['pistol']);
  assert.equal(profile.credits, 1200);
});

test('purchase refuses unknown, already-owned, and unaffordable weapons without replacing profile data', () => {
  const profile = normalizeProfile({
    version: PROFILE_VERSION,
    credits: 100,
    ownedWeaponIds: ['pistol'],
    equippedWeaponIds: ['pistol'],
  }, catalogs);

  for (const [id, reason] of [
    ['missing', 'unknown'],
    ['pistol', 'owned'],
    ['uzi', 'insufficient-funds'],
  ]) {
    const result = purchaseWeapon(profile, id, catalogs.weapons);
    assert.equal(result.ok, false);
    assert.equal(result.reason, reason);
    assert.equal(result.profile, profile);
  }
});

test('equipping accepts owned weapons while capacity remains and retains equipment order', () => {
  const profile = normalizeProfile({
    version: PROFILE_VERSION,
    ownedWeaponIds: ['pistol', 'uzi'],
    equippedWeaponIds: ['pistol'],
  }, catalogs);

  const result = toggleEquippedWeapon(profile, 'uzi');

  assert.equal(result.ok, true);
  assert.equal(result.reason, null);
  assert.deepEqual(result.profile.equippedWeaponIds, ['pistol', 'uzi']);
  assert.deepEqual(profile.equippedWeaponIds, ['pistol']);
  assert.notEqual(result.profile.equippedWeaponIds, profile.equippedWeaponIds);
});

test('a purchased weapon can be equipped next while preserving its exact deduction and loadout order', () => {
  const profile = normalizeProfile({
    version: PROFILE_VERSION,
    credits: 1200,
    ownedWeaponIds: ['pistol'],
    equippedWeaponIds: ['pistol'],
  }, catalogs);

  const purchase = purchaseWeapon(profile, 'uzi', catalogs.weapons);
  const equip = toggleEquippedWeapon(purchase.profile, 'uzi');

  assert.equal(purchase.ok, true);
  assert.equal(equip.ok, true);
  assert.equal(equip.profile.credits, 100);
  assert.deepEqual(equip.profile.ownedWeaponIds, ['pistol', 'uzi']);
  assert.deepEqual(equip.profile.equippedWeaponIds, ['pistol', 'uzi']);
  assert.deepEqual(profile.ownedWeaponIds, ['pistol']);
  assert.deepEqual(profile.equippedWeaponIds, ['pistol']);
  assert.equal(profile.credits, 1200);
});

test('equipping removes one weapon while another remains without mutating the input order', () => {
  const profile = normalizeProfile({
    version: PROFILE_VERSION,
    ownedWeaponIds: ['pistol', 'uzi', 'ak47'],
    equippedWeaponIds: ['pistol', 'uzi', 'ak47'],
  }, catalogs);

  const result = toggleEquippedWeapon(profile, 'uzi');

  assert.equal(result.ok, true);
  assert.equal(result.reason, null);
  assert.deepEqual(result.profile.equippedWeaponIds, ['pistol', 'ak47']);
  assert.deepEqual(profile.equippedWeaponIds, ['pistol', 'uzi', 'ak47']);
  assert.notEqual(result.profile, profile);
  assert.notEqual(result.profile.equippedWeaponIds, profile.equippedWeaponIds);
});

test('equipment toggling refuses unowned weapons, a full loadout, and removal of the final weapon', () => {
  const oneWeapon = createDefaultProfile();
  const fullLoadout = normalizeProfile({
    version: PROFILE_VERSION,
    ownedWeaponIds: ['pistol', 'uzi', 'ak47', 'awp', 'usp'],
    equippedWeaponIds: ['pistol', 'uzi', 'ak47', 'awp'],
  }, catalogs);

  for (const [profile, id, reason] of [
    [oneWeapon, 'uzi', 'not-owned'],
    [fullLoadout, 'usp', 'full'],
    [oneWeapon, 'pistol', 'last-equipped'],
  ]) {
    const result = toggleEquippedWeapon(profile, id);
    assert.equal(result.ok, false);
    assert.equal(result.reason, reason);
    assert.equal(result.profile, profile);
  }
});

test('map selection only changes to known map identifiers', () => {
  const profile = createDefaultProfile();
  const selected = selectProfileMap(profile, 'plaza-fountain', catalogs.maps);
  const rejected = selectProfileMap(profile, 'missing', catalogs.maps);

  assert.equal(selected.ok, true);
  assert.equal(selected.reason, null);
  assert.equal(selected.profile.selectedMapId, 'plaza-fountain');
  assert.notEqual(selected.profile, profile);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, 'unknown');
  assert.equal(rejected.profile, profile);
});

test('kill and wave rewards increment credits, kills, and per-map high water marks immutably', () => {
  const profile = {
    ...createDefaultProfile(),
    credits: 10,
    totalKills: 4,
    highestWaveByMap: { 'ship-deck': 3 },
  };

  const afterKill = awardKill(profile);
  const afterHigherWave = awardWave(afterKill, 'ship-deck', 5);
  const afterLowerWave = awardWave(afterHigherWave, 'ship-deck', 2);

  assert.deepEqual(afterKill, {
    ...profile,
    credits: 50,
    totalKills: 5,
  });
  assert.deepEqual(afterHigherWave, {
    ...afterKill,
    credits: 500,
    highestWaveByMap: { 'ship-deck': 5 },
  });
  assert.deepEqual(afterLowerWave, {
    ...afterHigherWave,
    credits: 950,
    highestWaveByMap: { 'ship-deck': 5 },
  });
  assert.notEqual(afterKill, profile);
  assert.notEqual(afterKill.highestWaveByMap, profile.highestWaveByMap);
  assert.notEqual(afterHigherWave.highestWaveByMap, afterKill.highestWaveByMap);
  assert.equal(profile.credits, 10);
});

class MemoryStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.get(key) ?? null;
  }

  setItem(key, value) {
    this.#values.set(key, String(value));
  }
}

test('profile storage persists and reloads normalized profile data using the versioned key', () => {
  const storage = new MemoryStorage();
  const adapter = createProfileStorage(storage);
  const profile = {
    ...createDefaultProfile(),
    credits: 2450,
    ownedWeaponIds: ['pistol', 'uzi'],
    equippedWeaponIds: ['pistol', 'uzi'],
    highestWaveByMap: { 'ship-deck': 4 },
    totalKills: 12,
  };

  assert.equal(adapter.isPersistent, true);
  assert.equal(adapter.save(profile), true);
  assert.equal(typeof storage.getItem(PROFILE_KEY), 'string');
  assert.deepEqual(adapter.load(), profile);
});

test('profile storage reads malformed or inaccessible data as a safe default profile', () => {
  const malformed = new MemoryStorage();
  malformed.setItem(PROFILE_KEY, '{this is not JSON');
  const throwing = {
    getItem() {
      throw new Error('storage blocked');
    },
    setItem() {},
  };

  assert.deepEqual(createProfileStorage(malformed).load(), createDefaultProfile());
  assert.deepEqual(createProfileStorage(throwing).load(), createDefaultProfile());
});

test('profile storage is non-persistent when a construction-time read fails and never throws on writes', () => {
  const unreadable = {
    getItem() {
      throw new Error('storage blocked');
    },
    setItem() {},
  };
  const unwritable = {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error('quota exceeded');
    },
  };
  const absent = createProfileStorage();
  const blocked = createProfileStorage(unreadable);
  const quotaExceeded = createProfileStorage(unwritable);

  assert.equal(absent.isPersistent, false);
  assert.deepEqual(absent.load(), createDefaultProfile());
  assert.equal(absent.save(createDefaultProfile()), false);
  assert.equal(blocked.isPersistent, false);
  assert.equal(blocked.save(createDefaultProfile()), false);
  assert.equal(quotaExceeded.isPersistent, true);
  assert.equal(quotaExceeded.save(createDefaultProfile()), false);
});
