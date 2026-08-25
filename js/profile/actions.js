import { MAP_CATALOG } from '../maps/catalog.js';
import { WEAPONS, createKnife } from '../weapons/weapons.js';
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
  // 玩家最多选 3 把主武器（数字键 1-3），第 4 槽永远留给近战刀。
  const userLoadout = equippedIds
    .filter(weaponId => Object.hasOwn(WEAPONS, weaponId))
    .slice(0, 3)
    .map(weaponId => createWeaponFn(weaponId));
  return [...userLoadout, createKnife()];
}
