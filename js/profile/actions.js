import { MAP_CATALOG } from '../maps/catalog.js';
import { WEAPONS } from '../weapons/weapons.js';
import {
  purchaseWeapon,
  selectProfileMap,
  toggleEquippedWeapon,
} from './profile.js';

export function createProfileActionController({
  getProfile,
  setProfile,
  storage,
  hub,
  getActionStatus,
}) {
  function setStatus(status) {
    hub.setStatus(status.message, status.tone);
  }

  function persistProfile(nextProfile, successMessage) {
    setProfile(nextProfile);
    const saved = storage.save(nextProfile);
    hub.refresh(nextProfile);
    setStatus(saved
      ? successMessage
      : getActionStatus('persistence', { ok: true, saved: false }));
  }

  function onPurchase(weaponId) {
    const result = purchaseWeapon(getProfile(), weaponId, WEAPONS);
    const status = getActionStatus(
      'purchase',
      result,
      WEAPONS[weaponId]?.name ?? '',
    );
    if (!result.ok) {
      setStatus(status);
      return false;
    }

    persistProfile(result.profile, status);
    return true;
  }

  function onToggleEquip(weaponId) {
    const result = toggleEquippedWeapon(getProfile(), weaponId);
    const equipped = result.ok && result.profile.equippedWeaponIds.includes(weaponId);
    const status = getActionStatus(
      'equip',
      result.ok ? { ...result, equipped } : result,
      WEAPONS[weaponId]?.name ?? '',
    );
    if (!result.ok) {
      setStatus(status);
      return false;
    }

    persistProfile(result.profile, status);
    return true;
  }

  function onSelectMap(mapId) {
    const result = selectProfileMap(getProfile(), mapId, MAP_CATALOG);
    const status = getActionStatus('map', result);
    if (!result.ok) {
      setStatus(status);
      return false;
    }

    persistProfile(result.profile, status);
    return true;
  }

  return {
    onPurchase,
    onToggleEquip,
    onSelectMap,
  };
}

export function createLoadoutFromProfile(profile, createWeaponFn) {
  const equippedIds = Array.isArray(profile?.equippedWeaponIds)
    ? profile.equippedWeaponIds
    : [];
  return equippedIds
    .filter(weaponId => Object.hasOwn(WEAPONS, weaponId))
    .map(weaponId => createWeaponFn(weaponId));
}
