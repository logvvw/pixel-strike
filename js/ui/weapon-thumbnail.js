/**
 * weapon-thumbnail.js — Small canvas preview of a weapon for the armory/store cards.
 *
 * Mirrors the per-profile dispatch in `renderer.js#drawWeapon` so the card preview
 * matches what the player sees in-game. Kept as a separate module so we can:
 *  - skip the hand/glove overlay (irrelevant at thumbnail scale)
 *  - skip bob/kick/reload animation (static preview)
 *  - draw into any-sized canvas (centers the weapon)
 *
 * If the per-profile logic in renderer.js changes, update the picker below.
 */

import { WEAPON_VISUALS, PALETTE, hexToRgb } from './theme.js';

const OPAQUE = 255;

function buildColors(visual) {
  return {
    body: hexToRgb(visual.body),
    metal: hexToRgb(visual.metal),
    grip: hexToRgb(visual.grip),
    accent: hexToRgb(visual.accent),
  };
}

/**
 * Returns RGB tuple [r, g, b] for a given pixel of the weapon visual, or null
 * if that pixel is empty. Mirrors `renderer.js#drawWeapon` dispatch (kept in
 * sync via comments).
 */
function pickWeaponPixelColor(nx, ny, gx, gy, visual, weaponId, colors) {
  // 默认后备：与 renderer 一致，未识别走 legacy default 分支。
  if (weaponId === 'pistol') {
    const slideY = 9 + Math.floor((gx - 7) * 0.28);
    if (gx >= 3 && gx < 8 && gy >= 11 && gy < 20) return colors.body;
    if (gx >= 7 && gx < 44 && gy >= slideY && gy < slideY + 11) return colors.metal;
    if (gx >= 10 && gx < 17 && gy >= 7 && gy < 9) return colors.accent;
    if (gx >= 7 && gx < 44 && gy >= slideY + 9 && gy < slideY + 14) return colors.body;
    const triggerGuard = (
      (gx >= 16 && gx < 19 && gy >= 27 && gy < 37)
      || (gx >= 27 && gx < 30 && gy >= 29 && gy < 37)
      || (gx >= 17 && gx < 30 && gy >= 34 && gy < 37)
    );
    if (triggerGuard) return colors.body;
    if (gx >= 26 && gx < 43 && gy >= 26 && gy < 53 && gx + gy < 88) return colors.grip;
    if (gx >= 30 && gx < 37 && gy >= 5 && gy < 8) return colors.accent;
    return null;
  }
  if (visual.profile === 'sidearm') {
    const slideTop = 0.16 + nx * 0.08;
    if (nx >= 0.12 && nx < 0.78 && ny >= slideTop && ny < slideTop + 0.18) {
      return colors.metal;
    }
    if (nx >= 0.18 && nx < 0.78 && ny >= slideTop + 0.15 && ny < 0.48) {
      return colors.body;
    }
    const triggerGuard = (
      (nx >= 0.34 && nx < 0.39 && ny >= 0.48 && ny < 0.69)
      || (nx >= 0.53 && nx < 0.58 && ny >= 0.50 && ny < 0.69)
      || (nx >= 0.34 && nx < 0.58 && ny >= 0.64 && ny < 0.70)
    );
    if (triggerGuard) return colors.body;
    if (nx >= 0.58 && nx < 0.84 && ny >= 0.46 && ny < 0.94 && nx + ny < 1.66) {
      return colors.grip;
    }
    if (visual.variant === 1 && nx >= 0.02 && nx < 0.20 && ny >= 0.21 && ny < 0.30) {
      return colors.body;
    }
    if (visual.variant === 2 && nx >= 0.23 && nx < 0.68 && ny >= 0.11 && ny < 0.17) {
      return colors.accent;
    }
    return null;
  }
  if (weaponId === 'uzi') {
    if (gx >= 2 && gx < 27 && gy >= 15 && gy < 21) return colors.metal;
    if (gx >= 22 && gx < 55 && gy >= 10 && gy < 39) return colors.body;
    if (gx >= 33 && gx < 50 && gy >= 39 && gy < 58) return colors.grip;
    if (gx >= 15 && gx < 23 && gy >= 29 && gy < 50) return colors.accent;
    if (gx >= 28 && gx < 53 && gy >= 7 && gy < 10) return colors.metal;
    return null;
  }
  if (visual.profile === 'smg') {
    if (nx >= 0.02 && nx < 0.39 && ny >= 0.24 && ny < 0.32) return colors.metal;
    if (nx >= 0.32 && nx < 0.76 && ny >= 0.18 && ny < 0.57) return colors.body;
    if (nx >= 0.74 && nx < 0.97 && ny >= 0.27 && ny < 0.48) return colors.grip;
    if (nx >= 0.48 && nx < 0.58 && ny >= 0.54 && ny < 0.88) return colors.accent;
    if (nx >= 0.62 && nx < 0.73 && ny >= 0.48 && ny < 0.78) return colors.grip;
    if (nx >= 0.37 && nx < 0.68 && ny >= 0.12 && ny < 0.17) return colors.metal;
    return null;
  }
  if (visual.profile === 'shotgun') {
    if (nx >= 0.01 && nx < 0.63 && ny >= 0.21 && ny < 0.29) return colors.metal;
    if (nx >= 0.25 && nx < 0.51 && ny >= 0.33 && ny < 0.47) return colors.accent;
    if (nx >= 0.55 && nx < 0.77 && ny >= 0.19 && ny < 0.47) return colors.body;
    if (nx >= 0.72 && nx < 0.98 && ny >= 0.30 && ny < 0.56) return colors.grip;
    if (nx >= 0.59 && nx < 0.70 && ny >= 0.45 && ny < 0.78) return colors.grip;
    if (visual.variant === 1 && nx >= 0.15 && nx < 0.55 && ny >= 0.16 && ny < 0.20) {
      return colors.body;
    }
    return null;
  }
  if (weaponId === 'ak47') {
    if (gx >= 1 && gx < 40 && gy >= 13 && gy < 18) return colors.metal;
    if (gx >= 22 && gx < 45 && gy >= 18 && gy < 29) return colors.accent;
    if (gx >= 40 && gx < 70 && gy >= 15 && gy < 35) return colors.body;
    if (gx >= 68 && gx < 87 && gy >= 20 && gy < 40) return colors.grip;
    if (gx >= 44 && gx < 61 && gy >= 34 && gy < 58 && gx + gy < 111) return colors.grip;
    if (gx >= 47 && gx < 66 && gy >= 11 && gy < 15) return colors.metal;
    return null;
  }
  if (visual.profile === 'rifle') {
    if (nx >= 0.01 && nx < 0.46 && ny >= 0.20 && ny < 0.27) return colors.metal;
    if (nx >= 0.22 && nx < 0.53 && ny >= 0.27 && ny < 0.42) return colors.accent;
    if (nx >= 0.45 && nx < 0.75 && ny >= 0.20 && ny < 0.49) return colors.body;
    if (nx >= 0.72 && nx < 0.98 && ny >= 0.29 && ny < 0.55) return colors.grip;
    if (nx >= 0.50 && nx < 0.63 && ny >= 0.47 && ny < 0.84) return colors.grip;
    if (visual.variant === 0 && nx >= 0.46 && nx < 0.67 && ny >= 0.10 && ny < 0.17) {
      return colors.metal;
    }
    if (visual.variant === 1 && nx >= 0.38 && nx < 0.68 && ny >= 0.14 && ny < 0.19) {
      return colors.metal;
    }
    return null;
  }
  // 默认后备（刀 / 未识别的 profile）— 与 renderer 的 legacy else 分支一致。
  if (gx >= 1 && gx < 48 && gy >= 15 && gy < 20) return colors.metal;
  if (gx >= 43 && gx < 80 && gy >= 14 && gy < 36) return colors.body;
  if (gx >= 50 && gx < 77 && gy >= 5 && gy < 13) return colors.metal;
  if (gx >= 58 && gx < 68 && gy >= 2 && gy < 7) return colors.accent;
  if (gx >= 78 && gx < 101 && gy >= 22 && gy < 39) return colors.grip;
  if (gx >= 51 && gx < 65 && gy >= 35 && gy < 57) return colors.grip;
  return null;
}

/**
 * Renders a weapon's silhouette into the given canvas at the weapon's native
 * pixel size (from WEAPON_VISUALS), centered if the canvas is larger. Hands
 * and muzzle flash are skipped — they're meaningless for a static card preview.
 *
 * Unknown weapon ids fall back to `pistol` so we never render an empty card.
 * Returns silently if the canvas / context is unavailable.
 */
export function renderWeaponThumbnail(canvas, weaponId, options = {}) {
  if (!canvas || typeof canvas.getContext !== 'function') return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const fallbackId = options.fallbackId ?? 'pistol';
  const visual = WEAPON_VISUALS[weaponId] ?? WEAPON_VISUALS[fallbackId];
  if (!visual) return;
  const resolvedId = WEAPON_VISUALS[weaponId] ? weaponId : fallbackId;

  const w = visual.width;
  const h = visual.height;
  const pixels = new Uint8ClampedArray(w * h * 4);
  const colors = buildColors(visual);

  for (let gx = 0; gx < w; gx++) {
    for (let gy = 0; gy < h; gy++) {
      const color = pickWeaponPixelColor(gx / w, gy / h, gx, gy, visual, resolvedId, colors);
      if (!color) continue;
      const idx = (gy * w + gx) * 4;
      pixels[idx] = color[0];
      pixels[idx + 1] = color[1];
      pixels[idx + 2] = color[2];
      pixels[idx + 3] = OPAQUE;
    }
  }

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 通过 ctx.createImageData 构造，避免在 Node 测试环境下依赖全局 ImageData。
  const imageData = ctx.createImageData(w, h);
  imageData.data.set(pixels);

  const offsetX = Math.floor((canvas.width - w) / 2);
  const offsetY = Math.floor((canvas.height - h) / 2);
  ctx.putImageData(imageData, offsetX, offsetY);
}
