/**
 * renderer.js — Raycasting 渲染引擎
 * DDA 算法，320x200 原始分辨率 → CSS 放大
 */

import { isWall } from './map.js';
import { getEnemyPart } from './enemy-silhouette.js';
import {
  PALETTE,
  WEAPON_VISUALS,
  hexToRgb,
  sampleMaterial,
} from '../ui/theme.js';

const W = 320;
const H = 200;
const FOV = Math.PI / 3;
const HALF_FOV = FOV / 2;
const MAX_DEPTH = 20;
const FOG_RGB = hexToRgb(PALETTE.GUNMETAL);
const SKY_TOP_RGB = hexToRgb(PALETTE.COAL);
const SKY_HORIZON_RGB = hexToRgb(PALETTE.OLIVE);
const FLOOR_HORIZON_RGB = hexToRgb(PALETTE.CONCRETE);
const FLOOR_NEAR_RGB = hexToRgb(PALETTE.GUNMETAL);

/**
 * The weapon model is anchored at the bottom of the screen. The visual's
 * normalized `muzzle` offset tells us where the barrel tip is relative to
 * the weapon's bounding box. The first-person camera is centered at the
 * middle of the screen, so the visible aim ray should line up with the
 * barrel tip, not the weapon's lower edge.
 */
const SCREEN_CENTER_Y = H / 2;

function mixRgb(from, to, amount) {
  const t = Math.max(0, Math.min(1, amount));
  return from.map((value, index) => Math.round(value + (to[index] - value) * t));
}

export function shadeRgb(rgb, side, distance) {
  const sideShade = side === 1 ? 0.82 : 1;
  const fogAmount = Math.max(0, Math.min(1, distance / MAX_DEPTH));
  const r = rgb[0] * sideShade;
  const g = rgb[1] * sideShade;
  const b = rgb[2] * sideShade;
  return [
    Math.round(r + (FOG_RGB[0] - r) * fogAmount),
    Math.round(g + (FOG_RGB[1] - g) * fogAmount),
    Math.round(b + (FOG_RGB[2] - b) * fogAmount),
  ];
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.imgData = this.ctx.createImageData(W, H);
    this.pixels = this.imgData.data;
    this.zBuffer = new Float32Array(W);
  }

  render(player, map, entities = [], feedback = null) {
    const p = this.pixels;
    const viewCenter = Math.floor(
      H / 2 + player.cameraOffset + (feedback?.screenKick ?? 0) * 2,
    );

    // 先绘制完整环境底色，确保远处和无墙列不会保留上一帧像素。
    for (let row = 0; row < H; row++) {
      const isSky = row < viewCenter;
      const span = Math.max(1, isSky ? viewCenter : H - viewCenter);
      const t = Math.abs(row - viewCenter) / span;
      const base = isSky
        ? mixRgb(SKY_HORIZON_RGB, SKY_TOP_RGB, t)
        : mixRgb(FLOOR_HORIZON_RGB, FLOOR_NEAR_RGB, t);
      const dither = ((row & 3) === 0 ? -3 : 0);

      for (let col = 0; col < W; col++) {
        const grain = ((col * 3 + row * 5) % 37 === 0) ? (isSky ? 5 : -5) : 0;
        const idx = (row * W + col) * 4;
        p[idx] = Math.max(0, base[0] + dither + grain);
        p[idx + 1] = Math.max(0, base[1] + dither + grain);
        p[idx + 2] = Math.max(0, base[2] + dither + grain);
        p[idx + 3] = 255;
      }
    }

    // === 射线投射墙壁 ===
    for (let col = 0; col < W; col++) {
      const rayAngle = player.angle - HALF_FOV + (col / W) * FOV;
      const { dist, tile, side, wallX } = this.castRay(player.x, player.y, rayAngle, map);

      // 修正鱼眼
      const perpDist = dist * Math.cos(rayAngle - player.angle);
      this.zBuffer[col] = perpDist;

      if (dist > MAX_DEPTH) continue;

      const lineHeight = Math.floor(H / perpDist);
      const drawStart = Math.floor(viewCenter - lineHeight / 2);
      const drawEnd = Math.floor(viewCenter + lineHeight / 2);

      // 世界坐标固定的 16×16 材质采样，避免转向时纹理随屏幕滑动。
      const texX = Math.floor(wallX * 16);
      const shadeCache = new Map();
      for (let row = Math.max(0, drawStart); row <= Math.min(H - 1, drawEnd); row++) {
        const texY = Math.floor(((row - drawStart) / Math.max(1, lineHeight)) * 16);
        const sample = sampleMaterial(tile, texX, texY);
        const sampleKey = (sample[0] << 16) | (sample[1] << 8) | sample[2];
        let shaded = shadeCache.get(sampleKey);
        if (!shaded) {
          shaded = shadeRgb(sample, side, perpDist);
          shadeCache.set(sampleKey, shaded);
        }
        const [r, g, b] = shaded;
        const idx = (row * W + col) * 4;
        p[idx]     = r;
        p[idx + 1] = g;
        p[idx + 2] = b;
        p[idx + 3] = 255;
      }

    }

    // === 绘制精灵 ===
    this.drawSprites(player, entities, viewCenter);

    // === 绘制武器 ===
    this.drawWeapon(player, feedback);

    this.ctx.putImageData(this.imgData, 0, 0);
  }

  /** DDA 射线-地图相交 */
  castRay(ox, oy, angle, map) {
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    let mapX = Math.floor(ox);
    let mapY = Math.floor(oy);

    const deltaDistX = Math.abs(1 / (dirX || 1e-10));
    const deltaDistY = Math.abs(1 / (dirY || 1e-10));

    let stepX, stepY, sideDistX, sideDistY;

    if (dirX < 0) {
      stepX = -1;
      sideDistX = (ox - mapX) * deltaDistX;
    } else {
      stepX = 1;
      sideDistX = (mapX + 1 - ox) * deltaDistX;
    }
    if (dirY < 0) {
      stepY = -1;
      sideDistY = (oy - mapY) * deltaDistY;
    } else {
      stepY = 1;
      sideDistY = (mapY + 1 - oy) * deltaDistY;
    }

    let side = 0;
    let dist = 0;
    let tile = 1;

    for (let step = 0; step < 64; step++) {
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += stepX;
        side = 0;
      } else {
        sideDistY += deltaDistY;
        mapY += stepY;
        side = 1;
      }

      if (mapY >= 0 && mapY < map.length && mapX >= 0 && mapX < map[0].length) {
        const t = map[mapY][mapX];
        if (isWall(map, mapX + 0.5, mapY + 0.5)) { tile = t; break; }
      } else {
        tile = 1; break;
      }
    }

    if (side === 0) dist = (mapX - ox + (1 - stepX) / 2) / (dirX || 1e-10);
    else            dist = (mapY - oy + (1 - stepY) / 2) / (dirY || 1e-10);

    const safeDist = Math.max(dist, 0.01);
    const hitWorld = side === 0 ? oy + safeDist * dirY : ox + safeDist * dirX;
    let wallX = hitWorld - Math.floor(hitWorld);
    if ((side === 0 && dirX > 0) || (side === 1 && dirY < 0)) wallX = 1 - wallX;
    if (wallX >= 1) wallX = 0;

    return { dist: safeDist, tile, side, wallX };
  }

  /** Billboard 精灵渲染 */
  drawSprites(player, entities, viewCenter = H / 2) {
    const sorted = entities
      .filter(e => e.visible !== false)
      .map(e => {
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        return {
          ...e,
          dist: Math.hypot(dx, dy),
          depth: dx * Math.cos(player.angle) + dy * Math.sin(player.angle),
        };
      })
      .sort((a, b) => b.depth - a.depth);

    for (const sp of sorted) {
      if (sp.dist < 0.2 || sp.depth <= 0.01) continue;

      let relAngle = Math.atan2(sp.y - player.y, sp.x - player.x) - player.angle;
      while (relAngle < -Math.PI) relAngle += 2 * Math.PI;
      while (relAngle > Math.PI) relAngle -= 2 * Math.PI;

      if (Math.abs(relAngle) > HALF_FOV + 0.1) continue;

      const screenX = Math.floor(W / 2 * (1 + relAngle / HALF_FOV));
      const size = Math.floor(H / sp.depth * 0.55);
      const halfSize = Math.floor(size / 2);

      const x0 = Math.max(0, screenX - halfSize);
      const x1 = Math.min(W - 1, screenX + halfSize);
      const y0 = Math.max(0, Math.floor(viewCenter - halfSize));
      const y1 = Math.min(H - 1, Math.floor(viewCenter + halfSize));

      if (x0 > x1 || y0 > y1) continue;

      const colors = {
        helmet: shadeRgb(hexToRgb(PALETTE.COAL), 0, sp.depth),
        face: shadeRgb(hexToRgb(PALETTE.LEGO_YELLOW), 0, sp.depth),
        vest: shadeRgb(hexToRgb(PALETTE.OLIVE), 0, sp.depth),
        webbing: shadeRgb(hexToRgb(PALETTE.DUST), 1, sp.depth),
        uniform: shadeRgb(hexToRgb(PALETTE.GUNMETAL), 0, sp.depth),
        hips: shadeRgb(hexToRgb(PALETTE.LEGO_BLUE), 0, sp.depth),
        arm: shadeRgb(hexToRgb(PALETTE.LEGO_YELLOW), 0, sp.depth),
        hand: shadeRgb(hexToRgb(PALETTE.LEGO_YELLOW), 1, sp.depth * 0.85),
        neck: shadeRgb(hexToRgb(PALETTE.LEGO_YELLOW), 0, sp.depth * 0.9),
        legs: shadeRgb(hexToRgb(PALETTE.LEGO_BLUE), 1, sp.depth),
        boots: shadeRgb(hexToRgb(PALETTE.LEGO_BROWN), 0, sp.depth),
        weapon: shadeRgb(hexToRgb(PALETTE.COAL), 1, sp.depth),
        item: shadeRgb(hexToRgb(sp.type === 'health' ? PALETTE.SAFE : PALETTE.RUST), 0, sp.depth),
        flash: shadeRgb(hexToRgb(PALETTE.IVORY), 0, sp.depth * 0.3),
      };

      for (let x = x0; x <= x1; x++) {
        if (sp.depth >= this.zBuffer[x]) continue;

        const sx = (x - (screenX - halfSize)) / size;
        for (let y = y0; y <= y1; y++) {
          const sy = (y - (viewCenter - halfSize)) / size;

          let color = null;
          if (sp.type !== 'enemy') {
            const diamond = Math.abs(sx - 0.5) + Math.abs(sy - 0.62) < 0.22;
            if (diamond) color = colors.item;
          } else {
            const part = getEnemyPart(sx, sy);
            if (part === 'uniform') color = colors.uniform;
            if (part === 'vest') color = colors.vest;
            if (part === 'webbing') color = colors.webbing;
            if (part === 'weapon') color = colors.weapon;
            if (part === 'face') color = colors.face;
            if (part === 'helmet') color = colors.helmet;
            if (part === 'hips') color = colors.hips;
            if (part === 'arm') color = colors.arm;
            if (part === 'hand') color = colors.hand;
            if (part === 'neck') color = colors.neck;
            if (part === 'legs') color = colors.legs;
            if (part === 'eye' || part === 'boots') color = colors.boots;
            if (color && sp.hitFlash > 0) color = colors.flash;
          }

          if (!color) continue;

          const idx = (y * W + x) * 4;
          this.pixels[idx]     = color[0];
          this.pixels[idx + 1] = color[1];
          this.pixels[idx + 2] = color[2];
          this.pixels[idx + 3] = 255;
        }
      }
    }
  }

  /**
   * Where the bullet should visually leave the barrel. The frame is anchored
   * at the bottom of the screen; the weapon visual itself was drawn relative
   * to the bottom edge. We align the bullet's screen-space Y coordinate with
   * the crosshair (screen center) so the aim ray matches the barrel tip.
   */
  getMuzzleAnchor(frame) {
    const muzzle = frame.visual.muzzle ?? { x: 0.05, y: 0.32 };
    const anchorX = frame.x + Math.round(frame.width * muzzle.x);
    // Clamp the muzzle Y so a custom visual can never drift below the
    // bottom of the screen or above the crosshair line.
    const anchorY = clamp(
      frame.y + Math.round(frame.height * muzzle.y),
      0,
      Math.round(SCREEN_CENTER_Y),
    );
    return { x: anchorX, y: anchorY };
  }

  getWeaponFrame(id, bobX = 0, bobY = 0, kick = 0) {
    const visual = WEAPON_VISUALS[id] ?? WEAPON_VISUALS.pistol;
    const x = Math.round((W - visual.width) / 2 + visual.stanceX + bobX);
    const y = Math.round(H - visual.height + Math.abs(bobY) + kick * 4);
    return { id, x, y, width: visual.width, height: visual.height, visual };
  }

  /** 绘制武器 (屏幕底部中央) */
  drawWeapon(player, feedback = null) {
    const p = this.pixels;
    const weapon = player.currentWeapon;
    if (!weapon) return;

    const bobX = Math.round(player.weaponBob || 0);
    const bobY = Math.round(Math.abs(player.weaponBob || 0) * 0.55);

    // 换弹动画
    let reloadOffset = 0;
    if (weapon.reloading) {
      const progress = (performance.now() - weapon.reloadEnd + weapon.reloadTime) / weapon.reloadTime;
      if (progress > 0 && progress < 1) {
        reloadOffset = Math.floor(Math.sin(progress * Math.PI) * 24);
      }
    }

    const frame = this.getWeaponFrame(
      weapon.id,
      bobX,
      bobY,
      feedback?.weaponKick ?? 0,
    );
    const colors = {
      body: hexToRgb(frame.visual.body),
      metal: hexToRgb(frame.visual.metal),
      grip: hexToRgb(frame.visual.grip),
      accent: hexToRgb(frame.visual.accent),
      glove: hexToRgb(PALETTE.OLIVE),
      cuff: hexToRgb(PALETTE.COAL),
    };
    const muzzle = this.getMuzzleAnchor(frame);
    let muzzleX = muzzle.x;
    let muzzleY = muzzle.y + reloadOffset;

    for (let gx = 0; gx < frame.width; gx++) {
      for (let gy = 0; gy < frame.height; gy++) {
        let color = null;
        const nx = gx / frame.width;
        const ny = gy / frame.height;

        if (weapon.id === 'pistol') {
          const slideY = 9 + Math.floor((gx - 7) * 0.28);
          if (gx >= 3 && gx < 8 && gy >= 11 && gy < 20) color = colors.body;
          if (gx >= 7 && gx < 44 && gy >= slideY && gy < slideY + 11) color = colors.metal;
          if (gx >= 10 && gx < 17 && gy >= 7 && gy < 9) color = colors.accent;
          if (gx >= 7 && gx < 44 && gy >= slideY + 9 && gy < slideY + 14) color = colors.body;
          const triggerGuard = (
            (gx >= 16 && gx < 19 && gy >= 27 && gy < 37)
            || (gx >= 27 && gx < 30 && gy >= 29 && gy < 37)
            || (gx >= 17 && gx < 30 && gy >= 34 && gy < 37)
          );
          if (triggerGuard) color = colors.body;
          if (gx >= 26 && gx < 43 && gy >= 26 && gy < 53 && gx + gy < 88) color = colors.grip;
          if (gx >= 30 && gx < 37 && gy >= 5 && gy < 8) color = colors.accent;
        } else if (frame.visual.profile === 'sidearm') {
          const slideTop = 0.16 + nx * 0.08;
          if (nx >= 0.12 && nx < 0.78 && ny >= slideTop && ny < slideTop + 0.18) {
            color = colors.metal;
          }
          if (nx >= 0.18 && nx < 0.78 && ny >= slideTop + 0.15 && ny < 0.48) {
            color = colors.body;
          }
          const triggerGuard = (
            (nx >= 0.34 && nx < 0.39 && ny >= 0.48 && ny < 0.69)
            || (nx >= 0.53 && nx < 0.58 && ny >= 0.50 && ny < 0.69)
            || (nx >= 0.34 && nx < 0.58 && ny >= 0.64 && ny < 0.70)
          );
          if (triggerGuard) color = colors.body;
          if (nx >= 0.58 && nx < 0.84 && ny >= 0.46 && ny < 0.94 && nx + ny < 1.66) {
            color = colors.grip;
          }
          if (frame.visual.variant === 1 && nx >= 0.02 && nx < 0.20 && ny >= 0.21 && ny < 0.30) {
            color = colors.body;
          }
          if (frame.visual.variant === 2 && nx >= 0.23 && nx < 0.68 && ny >= 0.11 && ny < 0.17) {
            color = colors.accent;
          }
        } else if (weapon.id === 'uzi') {
          if (gx >= 2 && gx < 27 && gy >= 15 && gy < 21) color = colors.metal;
          if (gx >= 22 && gx < 55 && gy >= 10 && gy < 39) color = colors.body;
          if (gx >= 33 && gx < 50 && gy >= 39 && gy < 58) color = colors.grip;
          if (gx >= 15 && gx < 23 && gy >= 29 && gy < 50) color = colors.accent;
          if (gx >= 28 && gx < 53 && gy >= 7 && gy < 10) color = colors.metal;
        } else if (frame.visual.profile === 'smg') {
          if (nx >= 0.02 && nx < 0.39 && ny >= 0.24 && ny < 0.32) color = colors.metal;
          if (nx >= 0.32 && nx < 0.76 && ny >= 0.18 && ny < 0.57) color = colors.body;
          if (nx >= 0.74 && nx < 0.97 && ny >= 0.27 && ny < 0.48) color = colors.grip;
          if (nx >= 0.48 && nx < 0.58 && ny >= 0.54 && ny < 0.88) color = colors.accent;
          if (nx >= 0.62 && nx < 0.73 && ny >= 0.48 && ny < 0.78) color = colors.grip;
          if (nx >= 0.37 && nx < 0.68 && ny >= 0.12 && ny < 0.17) color = colors.metal;
        } else if (frame.visual.profile === 'shotgun') {
          if (nx >= 0.01 && nx < 0.63 && ny >= 0.21 && ny < 0.29) color = colors.metal;
          if (nx >= 0.25 && nx < 0.51 && ny >= 0.33 && ny < 0.47) color = colors.accent;
          if (nx >= 0.55 && nx < 0.77 && ny >= 0.19 && ny < 0.47) color = colors.body;
          if (nx >= 0.72 && nx < 0.98 && ny >= 0.30 && ny < 0.56) color = colors.grip;
          if (nx >= 0.59 && nx < 0.70 && ny >= 0.45 && ny < 0.78) color = colors.grip;
          if (frame.visual.variant === 1 && nx >= 0.15 && nx < 0.55 && ny >= 0.16 && ny < 0.20) {
            color = colors.body;
          }
        } else if (weapon.id === 'ak47') {
          if (gx >= 1 && gx < 40 && gy >= 13 && gy < 18) color = colors.metal;
          if (gx >= 22 && gx < 45 && gy >= 18 && gy < 29) color = colors.accent;
          if (gx >= 40 && gx < 70 && gy >= 15 && gy < 35) color = colors.body;
          if (gx >= 68 && gx < 87 && gy >= 20 && gy < 40) color = colors.grip;
          if (gx >= 44 && gx < 61 && gy >= 34 && gy < 58 && gx + gy < 111) color = colors.grip;
          if (gx >= 47 && gx < 66 && gy >= 11 && gy < 15) color = colors.metal;
        } else if (frame.visual.profile === 'rifle') {
          if (nx >= 0.01 && nx < 0.46 && ny >= 0.20 && ny < 0.27) color = colors.metal;
          if (nx >= 0.22 && nx < 0.53 && ny >= 0.27 && ny < 0.42) color = colors.accent;
          if (nx >= 0.45 && nx < 0.75 && ny >= 0.20 && ny < 0.49) color = colors.body;
          if (nx >= 0.72 && nx < 0.98 && ny >= 0.29 && ny < 0.55) color = colors.grip;
          if (nx >= 0.50 && nx < 0.63 && ny >= 0.47 && ny < 0.84) color = colors.grip;
          if (frame.visual.variant === 0 && nx >= 0.46 && nx < 0.67 && ny >= 0.10 && ny < 0.17) {
            color = colors.metal;
          }
          if (frame.visual.variant === 1 && nx >= 0.38 && nx < 0.68 && ny >= 0.14 && ny < 0.19) {
            color = colors.metal;
          }
        } else {
          if (gx >= 1 && gx < 48 && gy >= 15 && gy < 20) color = colors.metal;
          if (gx >= 43 && gx < 80 && gy >= 14 && gy < 36) color = colors.body;
          if (gx >= 50 && gx < 77 && gy >= 5 && gy < 13) color = colors.metal;
          if (gx >= 58 && gx < 68 && gy >= 2 && gy < 7) color = colors.accent;
          if (gx >= 78 && gx < 101 && gy >= 22 && gy < 39) color = colors.grip;
          if (gx >= 51 && gx < 65 && gy >= 35 && gy < 57) color = colors.grip;
        }

        // 同一角色的手套随枪型移动：前手托住护木/泵柄，后手落在握把。
        const hands = frame.visual.hands;
        const supportHand = hands.support;
        if (nx >= supportHand.x0 && nx < supportHand.x1 && ny >= supportHand.y0) {
          color = ny >= supportHand.cuffY ? colors.cuff : colors.glove;
        }
        const gripHand = hands.grip;
        if (nx >= gripHand.x0 && nx < gripHand.x1 && ny >= gripHand.y0) {
          color = ny >= gripHand.cuffY ? colors.cuff : colors.glove;
        }

        if (!color) continue;

        const sx = frame.x + gx;
        const sy = frame.y + gy + reloadOffset;
        if (sx < 0 || sx >= W || sy < 0 || sy >= H) continue;

        const idx = (sy * W + sx) * 4;
        p[idx]     = color[0];
        p[idx + 1] = color[1];
        p[idx + 2] = color[2];
        p[idx + 3] = 255;
      }
    }

    // 枪口火焰 (射击瞬间)
    if ((feedback?.muzzle ?? 0) > 0) {
      const frame = feedback.muzzleFrame % 3;
      const flame = frame === 0
        ? [[2, 0], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [2, 3]]
        : [[1, 0], [3, 0], [2, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [1, 3], [3, 3]];
      for (const [fx, fy] of flame) {
        const sx = muzzleX - fx;
        const sy = muzzleY + fy - 2;
        if (sx < 0 || sx >= W || sy < 0 || sy >= H) continue;
        const idx = (sy * W + sx) * 4;
        p[idx] = 255;
        p[idx + 1] = fy < 2 ? 245 : 170;
        p[idx + 2] = fy < 2 ? 125 : 35;
        p[idx + 3] = 255;
      }
    }
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
