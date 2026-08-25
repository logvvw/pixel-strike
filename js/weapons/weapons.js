/**
 * weapons.js — 武器定义
 */

import { isWall } from '../engine/map.js';
import { getEnemyPart, isEnemyHeadPart } from '../engine/enemy-silhouette.js';

const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 200;
const HALF_FOV = Math.PI / 6;
const SPRITE_SCALE = 0.55;

export const WEAPONS = {
  pistol: {
    id: 'pistol',
    name: 'Glock-18',
    category: 'SIDEARM',
    description: '均衡副武器 / Balanced sidearm',
    unlockPrice: 0,
    price: 0,
    display: { power: 28, rate: 65, accuracy: 75, control: 72, capacity: 67 },
    damage: 14,
    headshotMult: 2.0,
    fireRate: 150,     // ms per shot
    magazine: 20,
    reserveAmmo: Infinity,
    reloadTime: 1500,  // ms
    baseSpread: 0.006,
    moveSpread: 0.025,
    shotSpread: 0.008,
    maxSpread: 0.055,
    spreadRecovery: 0.11,
    recoilPitch: 0.45,
    recoilYaw: 0.0025,
    recoilRecovery: 4.5,
    kick: 0.65,
    range: 20,         // 有效射程
    auto: false,
  },
  usp: {
    id: 'usp',
    name: 'USP-S',
    category: 'SIDEARM',
    description: '低后坐、高首发精度 / Low recoil, accurate first shot',
    unlockPrice: 400,
    price: 400,
    display: { power: 36, rate: 52, accuracy: 86, control: 85, capacity: 40 },
    damage: 18,
    headshotMult: 2,
    fireRate: 220,
    magazine: 12,
    reserveAmmo: 72,
    reloadTime: 1700,
    baseSpread: 0.004,
    moveSpread: 0.022,
    shotSpread: 0.008,
    maxSpread: 0.052,
    spreadRecovery: 0.12,
    recoilPitch: 0.38,
    recoilYaw: 0.002,
    recoilRecovery: 4.8,
    kick: 0.55,
    range: 22,
    auto: false,
  },
  deagle: {
    id: 'deagle',
    name: 'Desert Eagle',
    category: 'SIDEARM',
    description: '慢射速、高单发伤害 / Slow, high-impact sidearm',
    unlockPrice: 900,
    price: 900,
    display: { power: 92, rate: 36, accuracy: 79, control: 38, capacity: 23 },
    damage: 46,
    headshotMult: 2,
    fireRate: 320,
    magazine: 7,
    reserveAmmo: 35,
    reloadTime: 2100,
    baseSpread: 0.006,
    moveSpread: 0.05,
    shotSpread: 0.018,
    maxSpread: 0.09,
    spreadRecovery: 0.095,
    recoilPitch: 0.9,
    recoilYaw: 0.004,
    recoilRecovery: 3.2,
    kick: 1.05,
    range: 24,
    auto: false,
  },
  uzi: {
    id: 'uzi',
    name: 'MP9',
    category: 'SMG',
    description: '近距高射速 / Close-range high fire rate',
    unlockPrice: 1100,
    price: 1100,
    display: { power: 24, rate: 95, accuracy: 45, control: 70, capacity: 100 },
    damage: 12,
    headshotMult: 2.0,
    fireRate: 60,
    magazine: 30,
    reserveAmmo: 120,
    reloadTime: 1800,
    baseSpread: 0.012,
    moveSpread: 0.04,
    shotSpread: 0.009,
    maxSpread: 0.095,
    spreadRecovery: 0.12,
    recoilPitch: 0.34,
    recoilYaw: 0.0035,
    recoilRecovery: 4.8,
    kick: 0.55,
    range: 15,
    auto: true,
  },
  ump45: {
    id: 'ump45',
    name: 'UMP-45',
    category: 'SMG',
    description: '中速稳定、较高伤害 / Stable mid-rate SMG with heavier hits',
    unlockPrice: 1400,
    price: 1400,
    display: { power: 34, rate: 78, accuracy: 55, control: 68, capacity: 83 },
    damage: 17,
    headshotMult: 2,
    fireRate: 90,
    magazine: 25,
    reserveAmmo: 100,
    reloadTime: 2200,
    baseSpread: 0.01,
    moveSpread: 0.035,
    shotSpread: 0.009,
    maxSpread: 0.085,
    spreadRecovery: 0.115,
    recoilPitch: 0.4,
    recoilYaw: 0.0035,
    recoilRecovery: 4.4,
    kick: 0.62,
    range: 18,
    auto: true,
  },
  nova: {
    id: 'nova',
    name: 'Nova',
    category: 'SHOTGUN',
    description: '泵动、近距多弹丸 / Pump-action close-range spread',
    unlockPrice: 1600,
    price: 1600,
    display: { power: 72, rate: 18, accuracy: 30, control: 38, capacity: 27 },
    damage: 9,
    headshotMult: 1.35,
    fireRate: 800,
    magazine: 8,
    reserveAmmo: 32,
    reloadTime: 2600,
    baseSpread: 0.012,
    moveSpread: 0.04,
    shotSpread: 0.015,
    maxSpread: 0.1,
    spreadRecovery: 0.1,
    recoilPitch: 0.9,
    recoilYaw: 0.003,
    recoilRecovery: 3.2,
    kick: 1.15,
    range: 12,
    auto: false,
    pellets: 8,
    pelletSpread: 0.085,
  },
  xm1014: {
    id: 'xm1014',
    name: 'XM1014',
    category: 'SHOTGUN',
    description: '半自动、较宽扩散 / Fast shotgun with a wider spread',
    unlockPrice: 2400,
    price: 2400,
    display: { power: 63, rate: 50, accuracy: 25, control: 45, capacity: 23 },
    damage: 7,
    headshotMult: 1.25,
    fireRate: 240,
    magazine: 7,
    reserveAmmo: 28,
    reloadTime: 2800,
    baseSpread: 0.015,
    moveSpread: 0.05,
    shotSpread: 0.016,
    maxSpread: 0.12,
    spreadRecovery: 0.09,
    recoilPitch: 0.65,
    recoilYaw: 0.004,
    recoilRecovery: 3.6,
    kick: 0.9,
    range: 11,
    auto: false,
    pellets: 7,
    pelletSpread: 0.1,
  },
  famas: {
    id: 'famas',
    name: 'FAMAS',
    category: 'RIFLE',
    description: '入门步枪、易控 / Accessible, controllable rifle',
    unlockPrice: 2200,
    price: 2200,
    display: { power: 44, rate: 78, accuracy: 62, control: 65, capacity: 83 },
    damage: 22,
    headshotMult: 2,
    fireRate: 90,
    magazine: 25,
    reserveAmmo: 75,
    reloadTime: 2400,
    baseSpread: 0.008,
    moveSpread: 0.04,
    shotSpread: 0.01,
    maxSpread: 0.095,
    spreadRecovery: 0.11,
    recoilPitch: 0.48,
    recoilYaw: 0.0038,
    recoilRecovery: 4.1,
    kick: 0.75,
    range: 21,
    auto: true,
  },
  m4a1: {
    id: 'm4a1',
    name: 'M4A1-S',
    category: 'RIFLE',
    description: '稳定持续射击 / Stable sustained fire',
    unlockPrice: 3200,
    price: 3200,
    display: { power: 48, rate: 76, accuracy: 72, control: 72, capacity: 83 },
    damage: 24,
    headshotMult: 2,
    fireRate: 92,
    magazine: 25,
    reserveAmmo: 75,
    reloadTime: 2500,
    baseSpread: 0.006,
    moveSpread: 0.035,
    shotSpread: 0.009,
    maxSpread: 0.085,
    spreadRecovery: 0.115,
    recoilPitch: 0.44,
    recoilYaw: 0.0032,
    recoilRecovery: 4.3,
    kick: 0.72,
    range: 23,
    auto: true,
  },
  ak47: {
    id: 'ak47',
    name: 'AK-47',
    category: 'RIFLE',
    description: '高伤害、明显可控后坐 / High damage with readable recoil',
    unlockPrice: 3000,
    price: 3000,
    display: { power: 56, rate: 72, accuracy: 60, control: 55, capacity: 100 },
    damage: 28,
    headshotMult: 2.0,
    fireRate: 100,
    magazine: 30,
    reserveAmmo: 90,
    reloadTime: 2500,
    baseSpread: 0.008,
    moveSpread: 0.05,
    shotSpread: 0.012,
    maxSpread: 0.11,
    spreadRecovery: 0.105,
    recoilPitch: 0.62,
    recoilYaw: 0.0045,
    recoilRecovery: 3.7,
    kick: 0.9,
    range: 20,
    auto: true,
  },
  scout: {
    id: 'scout',
    name: 'SSG 08',
    category: 'PRECISION',
    description: '轻型狙击、快速复位 / Mobile precision rifle with quick recovery',
    unlockPrice: 2800,
    price: 2800,
    display: { power: 68, rate: 16, accuracy: 92, control: 52, capacity: 33 },
    damage: 68,
    headshotMult: 1.5,
    fireRate: 850,
    magazine: 10,
    reserveAmmo: 30,
    reloadTime: 2900,
    baseSpread: 0.0025,
    moveSpread: 0.08,
    shotSpread: 0.02,
    maxSpread: 0.12,
    spreadRecovery: 0.15,
    recoilPitch: 0.82,
    recoilYaw: 0.0025,
    recoilRecovery: 3.1,
    kick: 1.05,
    range: 30,
    auto: false,
  },
  awp: {
    id: 'awp',
    name: 'AWP',
    category: 'PRECISION',
    description: '慢射速、极高伤害 / Slow, overwhelming precision damage',
    unlockPrice: 4200,
    price: 4200,
    display: { power: 100, rate: 8, accuracy: 98, control: 30, capacity: 17 },
    damage: 100,
    headshotMult: 1.0,  // 本身已极高
    fireRate: 1500,
    magazine: 5,
    reserveAmmo: 20,
    reloadTime: 3500,
    baseSpread: 0.002,
    moveSpread: 0.12,
    shotSpread: 0.025,
    maxSpread: 0.14,
    spreadRecovery: 0.16,
    recoilPitch: 1.1,
    recoilYaw: 0.003,
    recoilRecovery: 2.7,
    kick: 1.35,
    range: 30,
    auto: false,
  },
};

// 永久免费的近战武器。damage 足够在近距离 2-3 刀解决低波次敌人，
// 无限弹夹与无后坐使切刀时不会有手感惩罚；冷切时长 350ms 让节奏
// 比子弹更慢，鼓励近距离连续命中而不是 spam 鼠标。
export const KNIFE_DEF = Object.freeze({
  id: 'knife',
  name: 'Knife',
  category: 'MELEE',
  description: '近战武器 · 永久免费 / Permanent melee',
  unlockPrice: 0,
  price: 0,
  damage: 40,
  headshotMult: 1.5,
  fireRate: 350,
  magazine: Infinity,
  reserveAmmo: Infinity,
  reloadTime: 0,
  baseSpread: 0,
  moveSpread: 0,
  shotSpread: 0,
  maxSpread: 0,
  spreadRecovery: 0,
  recoilPitch: 0,
  recoilYaw: 0,
  recoilRecovery: 0,
  kick: 0,
  range: 1.5,
  auto: false,
  melee: true,
});

export function createKnife() {
  return {
    ...KNIFE_DEF,
    currentAmmo: Infinity,
    currentSpread: 0,
    shotIndex: 0,
    recoilX: 0,
    recoilY: 0,
    lastShotAt: -Infinity,
    lastFireTime: -Infinity,
    reloading: false,
    reloadEnd: 0,
  };
}

/** 创建武器实例 */
export function createWeapon(id) {
  const def = WEAPONS[id];
  if (!def) throw new Error(`Unknown weapon: ${id}`);
  return {
    ...def,
    currentAmmo: def.magazine,
    currentSpread: def.baseSpread,
    shotIndex: 0,
    recoilX: 0,
    recoilY: 0,
    lastShotAt: -Infinity,
    lastFireTime: -Infinity,
    reloading: false,
    reloadEnd: 0,
  };
}

const notFired = reason => ({ fired: false, reason, hit: null, hits: [] });
const HORIZONTAL_RECOIL = [-1, 0.5, 1, -0.5, 0.75, -0.75];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function approach(value, target, amount) {
  if (value < target) return Math.min(target, value + amount);
  return Math.max(target, value - amount);
}

export function getEffectiveSpread(weapon, movementIntensity = 0) {
  const movement = clamp(movementIntensity, 0, 1);
  return Math.min(
    weapon.maxSpread,
    weapon.currentSpread + (weapon.moveSpread ?? 0) * movement,
  );
}

/** 射击判定 */
export function tryFire(weapon, player, entities, map, now, options = {}) {
  const random = options.random ?? Math.random;
  if (weapon.reloading) return notFired('reloading');
  if (weapon.currentAmmo <= 0) {
    reloadWeapon(weapon, player, now);
    return notFired('empty');
  }
  if (now - weapon.lastFireTime < weapon.fireRate) return notFired('cooldown');

  weapon.currentAmmo--;
  weapon.lastFireTime = now;
  weapon.lastShotAt = now;

  // 射线命中检测
  const spread = getEffectiveSpread(weapon, player.movementIntensity ?? 0);
  const pelletCount = weapon.pellets ?? 1;
  const spreadWidth = spread + (weapon.pelletSpread ?? 0);
  const hits = [];
  let hit = null;
  let rayAngle = player.angle;
  for (let pellet = 0; pellet < pelletCount; pellet++) {
    const pelletAngle = player.angle + (random() - 0.5) * spreadWidth;
    if (pellet === 0) rayAngle = pelletAngle;
    const pelletHit = raycastHit(
      player.x,
      player.y,
      pelletAngle,
      weapon.range,
      entities,
      map,
      player.cameraOffset ?? 0,
    );
    if (pelletHit) {
      pelletHit.damage = pelletHit.isHeadshot
        ? weapon.damage * weapon.headshotMult
        : weapon.damage;
      hits.push(pelletHit);
      if (!hit || pelletHit.dist < hit.dist) hit = pelletHit;
    }
  }

  const pattern = HORIZONTAL_RECOIL[weapon.shotIndex % HORIZONTAL_RECOIL.length];
  const recoil = {
    x: pattern * weapon.recoilYaw,
    y: weapon.recoilPitch * (1 + Math.min(weapon.shotIndex, 6) * 0.06),
    kick: weapon.kick,
  };
  weapon.shotIndex++;
  weapon.currentSpread = Math.min(
    weapon.maxSpread,
    weapon.currentSpread + weapon.shotSpread,
  );
  weapon.recoilX += recoil.x;
  weapon.recoilY += recoil.y;

  return {
    fired: true,
    reason: null,
    hit,
    hits,
    rayAngle,
    spread,
    recoil,
  };
}

/**
 * 近战挥击判定：复用射线命中检测（短射程），但无视弹夹与散布，
 * 命中后直接应用 weapon.damage（或爆头倍率）。冷切由 weapon.fireRate 控
 * 制，与 tryFire 一致，这样无论是刀还是枪都共享冷却节拍。
 */
export function tryMelee(weapon, player, entities, map, now) {
  if (now - weapon.lastFireTime < weapon.fireRate) {
    return notFired('cooldown');
  }
  weapon.lastFireTime = now;
  weapon.lastShotAt = now;

  const hit = raycastHit(
    player.x,
    player.y,
    player.angle,
    weapon.range,
    entities,
    map,
    player.cameraOffset ?? 0,
  );
  const hits = hit ? [hit] : [];
  if (hit) {
    hit.damage = hit.isHeadshot
      ? weapon.damage * weapon.headshotMult
      : weapon.damage;
  }
  return {
    fired: true,
    reason: null,
    hit,
    hits,
    rayAngle: player.angle,
    spread: 0,
    recoil: { x: 0, y: 0, kick: 0 },
  };
}

/** 按真实时间恢复散布与后坐，避免刷新率影响手感。 */
export function updateWeaponHandling(weapon, dt, now) {
  if (now - weapon.lastShotAt > 100) {
    weapon.currentSpread = Math.max(
      weapon.baseSpread,
      weapon.currentSpread - weapon.spreadRecovery * dt,
    );
  }
  weapon.recoilX = approach(weapon.recoilX, 0, weapon.recoilRecovery * dt);
  weapon.recoilY = approach(weapon.recoilY, 0, weapon.recoilRecovery * dt);

  const settled = weapon.currentSpread <= weapon.baseSpread + 0.001;
  if (now - weapon.lastShotAt > 220 && settled) weapon.shotIndex = 0;
}

/** 换弹 */
export function reloadWeapon(weapon, player, now = performance.now()) {
  if (weapon.reloading) return;
  if (weapon.currentAmmo === weapon.magazine) return;
  if (weapon.reserveAmmo <= 0) return;

  weapon.reloading = true;
  weapon.reloadEnd = now + weapon.reloadTime;
}

export function updateReload(weapon, now) {
  if (!weapon.reloading) return;
  if (now >= weapon.reloadEnd) {
    const needed = weapon.magazine - weapon.currentAmmo;
    const available = Math.min(needed, weapon.reserveAmmo);
    weapon.currentAmmo += available;
    weapon.reserveAmmo -= available;
    weapon.reloading = false;
  }
}

/** 射线命中检测（对实体） */
export function raycastHit(ox, oy, angle, maxDist, entities, map, cameraOffset = 0) {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);

  let closestHit = null;
  let closestDist = maxDist;

  // 检查实体
  for (const e of entities) {
    if (!e.alive) continue;
    const hit = hitEntity(ox, oy, dirX, dirY, e, maxDist, cameraOffset);
    if (hit && hit.dist < closestDist) {
      closestDist = hit.dist;
      closestHit = hit;
    }
  }

  // 检查墙壁（取最近）
  const wallHit = raycastWall(ox, oy, dirX, dirY, maxDist, map);
  if (wallHit && wallHit.dist < closestDist) {
    closestHit = null; // 被子弹打墙了
  }

  return closestHit;
}

/** 射线-实体命中检测 */
function hitEntity(ox, oy, dirX, dirY, entity, maxDist, cameraOffset) {
  const dx = entity.x - ox;
  const dy = entity.y - oy;
  const distToEntity = Math.sqrt(dx * dx + dy * dy);
  if (distToEntity > maxDist) return null;

  // 投影到射线方向（沿射线的距离）
  const dot = dx * dirX + dy * dirY;
  if (dot < 0) return null;

  // 最近点到实体的垂直距离（叉积公式）
  const signedPerp = dx * dirY - dy * dirX;
  const perpDist = Math.abs(signedPerp);

  const radius = entity.radius || 0.3;
  if (perpDist > radius) return null;

  // 与 renderer.js 的 200px 视口和 0.55 精灵缩放保持一致。
  const spriteSize = Math.max(1, VIEW_HEIGHT / dot * SPRITE_SCALE);
  const verticalRatio = 0.5 - cameraOffset / spriteSize;
  const relativeAngle = Math.atan2(-signedPerp, dot);
  const horizontalOffset = VIEW_WIDTH / 2 * (relativeAngle / HALF_FOV);
  const horizontalRatio = 0.5 - horizontalOffset / spriteSize;
  const part = getEnemyPart(horizontalRatio, verticalRatio);
  if (!part) return null;
  const headAligned = isEnemyHeadPart(part);

  return {
    entity,
    dist: dot,
    isHeadshot: entity.hitBox === 'head' || headAligned,
    damage: 0,
  };
}

/** 射线-墙壁命中 */
function raycastWall(ox, oy, dirX, dirY, maxDist, map) {
  let mapX = Math.floor(ox);
  let mapY = Math.floor(oy);
  const deltaDistX = Math.abs(1 / (dirX || 1e-10));
  const deltaDistY = Math.abs(1 / (dirY || 1e-10));
  const stepX = dirX < 0 ? -1 : 1;
  const stepY = dirY < 0 ? -1 : 1;
  let sideDistX = dirX < 0 ? (ox - mapX) * deltaDistX : (mapX + 1 - ox) * deltaDistX;
  let sideDistY = dirY < 0 ? (oy - mapY) * deltaDistY : (mapY + 1 - oy) * deltaDistY;

  let side = 0;
  for (let i = 0; i < 128; i++) {
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapX += stepX;
      side = 0;
    } else {
      sideDistY += deltaDistY;
      mapY += stepY;
      side = 1;
    }
    if (mapY < 0 || mapY >= map.length || mapX < 0 || mapX >= map[0].length) return null;

    const dist = side === 0
      ? (mapX - ox + (1 - stepX) / 2) / (dirX || 1e-10)
      : (mapY - oy + (1 - stepY) / 2) / (dirY || 1e-10);
    if (dist > maxDist) return null;
    if (isWall(map, mapX + 0.5, mapY + 0.5)) return { dist };
  }
  return null;
}
