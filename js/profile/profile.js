import { DEFAULT_MAP_ID, MAP_CATALOG } from '../maps/catalog.js';
import { WEAPONS } from '../weapons/weapons.js';

export const PROFILE_VERSION = 1;
export const PROFILE_KEY = 'pixstrike.profile.v1';

const DEFAULT_CREDITS = 1800;
const DEFAULT_WEAPON_ID = 'pistol';
const MAX_EQUIPPED_WEAPONS = 4;

export function createDefaultProfile() {
  return {
    version: PROFILE_VERSION,
    credits: DEFAULT_CREDITS,
    ownedWeaponIds: [DEFAULT_WEAPON_ID],
    equippedWeaponIds: [DEFAULT_WEAPON_ID],
    selectedMapId: DEFAULT_MAP_ID,
    highestWaveByMap: {},
    totalKills: 0,
  };
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function catalogValues(catalog) {
  if (Array.isArray(catalog)) return catalog;
  return isRecord(catalog) ? Object.values(catalog) : [];
}

function getCatalogs(catalogs = {}) {
  const source = isRecord(catalogs) ? catalogs : {};
  const weapons = catalogValues(source.weapons ?? source.weaponCatalog ?? WEAPONS);
  const maps = catalogValues(source.maps ?? source.mapCatalog ?? MAP_CATALOG);
  return {
    weaponIds: new Set(weapons.filter(isRecord).map(weapon => weapon.id).filter(id => typeof id === 'string')),
    mapIds: new Set(maps.filter(isRecord).map(map => map.id).filter(id => typeof id === 'string')),
  };
}

function nonNegativeSafeInteger(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(value)));
}

function uniqueKnownIds(value, ids) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.filter(id => typeof id === 'string' && ids.has(id) && !seen.has(id) && (seen.add(id), true));
}

function cloneProfile(profile) {
  return {
    ...profile,
    ownedWeaponIds: Array.isArray(profile.ownedWeaponIds) ? [...profile.ownedWeaponIds] : [],
    equippedWeaponIds: Array.isArray(profile.equippedWeaponIds) ? [...profile.equippedWeaponIds] : [],
    highestWaveByMap: isRecord(profile.highestWaveByMap) ? { ...profile.highestWaveByMap } : {},
  };
}

function findCatalogItem(catalog, id) {
  return catalogValues(catalog).find(item => isRecord(item) && item.id === id);
}

export function normalizeProfile(value, catalogs) {
  const defaults = createDefaultProfile();
  const source = isRecord(value) && value.version === PROFILE_VERSION ? value : defaults;
  const { weaponIds, mapIds } = getCatalogs(catalogs);
  const defaultMapId = mapIds.has(DEFAULT_MAP_ID)
    ? DEFAULT_MAP_ID
    : (mapIds.values().next().value ?? DEFAULT_MAP_ID);
  const ownedWeaponIds = uniqueKnownIds(source.ownedWeaponIds, weaponIds);

  if (!ownedWeaponIds.includes(DEFAULT_WEAPON_ID)) ownedWeaponIds.push(DEFAULT_WEAPON_ID);

  const equippedWeaponIds = uniqueKnownIds(source.equippedWeaponIds, weaponIds)
    .filter(id => ownedWeaponIds.includes(id))
    .slice(0, MAX_EQUIPPED_WEAPONS);
  if (equippedWeaponIds.length === 0) equippedWeaponIds.push(DEFAULT_WEAPON_ID);

  const highestWaveByMap = {};
  if (isRecord(source.highestWaveByMap)) {
    for (const [mapId, wave] of Object.entries(source.highestWaveByMap)) {
      if (mapIds.has(mapId)) highestWaveByMap[mapId] = nonNegativeSafeInteger(wave);
    }
  }

  return {
    version: PROFILE_VERSION,
    credits: nonNegativeSafeInteger(
      Object.hasOwn(source, 'credits') ? source.credits : defaults.credits,
    ),
    ownedWeaponIds,
    equippedWeaponIds,
    selectedMapId: mapIds.has(source.selectedMapId) ? source.selectedMapId : defaultMapId,
    highestWaveByMap,
    totalKills: nonNegativeSafeInteger(source.totalKills),
  };
}

export function purchaseWeapon(profile, id, weaponCatalog = WEAPONS) {
  const weapon = findCatalogItem(weaponCatalog, id);
  if (!weapon) return { profile, ok: false, reason: 'unknown' };
  if (profile.ownedWeaponIds?.includes(id)) return { profile, ok: false, reason: 'owned' };

  const unlockPrice = nonNegativeSafeInteger(weapon.unlockPrice ?? weapon.price);
  if (nonNegativeSafeInteger(profile.credits) < unlockPrice) {
    return { profile, ok: false, reason: 'insufficient-funds' };
  }

  const next = cloneProfile(profile);
  next.credits = nonNegativeSafeInteger(profile.credits) - unlockPrice;
  next.ownedWeaponIds.push(id);
  return { profile: next, ok: true, reason: null };
}

export function toggleEquippedWeapon(profile, id) {
  if (!profile.ownedWeaponIds?.includes(id)) return { profile, ok: false, reason: 'not-owned' };

  const equippedWeaponIds = Array.isArray(profile.equippedWeaponIds)
    ? profile.equippedWeaponIds
    : [];
  const equippedIndex = equippedWeaponIds.indexOf(id);
  if (equippedIndex >= 0) {
    if (equippedWeaponIds.length <= 1) return { profile, ok: false, reason: 'last-equipped' };
    const next = cloneProfile(profile);
    next.equippedWeaponIds.splice(equippedIndex, 1);
    return { profile: next, ok: true, reason: null };
  }
  if (equippedWeaponIds.length >= MAX_EQUIPPED_WEAPONS) {
    return { profile, ok: false, reason: 'full' };
  }

  const next = cloneProfile(profile);
  next.equippedWeaponIds.push(id);
  return { profile: next, ok: true, reason: null };
}

export function selectProfileMap(profile, mapId, mapCatalog = MAP_CATALOG) {
  if (!findCatalogItem(mapCatalog, mapId)) return { profile, ok: false, reason: 'unknown' };

  const next = cloneProfile(profile);
  next.selectedMapId = mapId;
  return { profile: next, ok: true, reason: null };
}

export function awardKill(profile) {
  const next = cloneProfile(profile);
  next.credits = Math.min(Number.MAX_SAFE_INTEGER, nonNegativeSafeInteger(profile.credits) + 40);
  next.totalKills = Math.min(Number.MAX_SAFE_INTEGER, nonNegativeSafeInteger(profile.totalKills) + 1);
  return next;
}

export function awardWave(profile, mapId, wave) {
  const next = cloneProfile(profile);
  next.credits = Math.min(Number.MAX_SAFE_INTEGER, nonNegativeSafeInteger(profile.credits) + 450);
  const previousWave = nonNegativeSafeInteger(next.highestWaveByMap[mapId]);
  next.highestWaveByMap[mapId] = Math.max(previousWave, nonNegativeSafeInteger(wave));
  return next;
}
