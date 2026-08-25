/**
 * PixStrike tactical-industrial visual language.
 * All canvas and DOM presentation pulls from this small, dependency-free contract.
 */

export const PALETTE = Object.freeze({
  INK: '#11130F',
  COAL: '#232721',
  GUNMETAL: '#3C4239',
  CONCRETE: '#777468',
  SAND: '#A69A7B',
  DUST: '#C2B28C',
  OLIVE: '#59604A',
  RUST: '#8A4F36',
  UI_AMBER: '#E3B341',
  IVORY: '#DDD8C4',
  MUTED: '#858778',
  SAFE: '#87A36F',
  DANGER: '#C65343',
  LEGO_YELLOW: '#F2CD37',
  LEGO_BROWN: '#5A3A1A',
  LEGO_BLUE: '#0D6BC8',
  LEGO_RED: '#C91A09',
});

export function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export const MATERIALS = Object.freeze({
  1: Object.freeze({ name: 'CONCRETE', base: PALETTE.CONCRETE, accent: PALETTE.DUST }),
  2: Object.freeze({ name: 'WOOD', base: PALETTE.SAND, accent: PALETTE.RUST }),
  3: Object.freeze({ name: 'BRICK', base: PALETTE.RUST, accent: PALETTE.INK }),
  4: Object.freeze({ name: 'METAL', base: PALETTE.GUNMETAL, accent: PALETTE.OLIVE }),
});

const MATERIAL_RGB = Object.freeze(Object.fromEntries(
  Object.entries(MATERIALS).map(([tile, material]) => {
    const base = hexToRgb(material.base);
    const accent = hexToRgb(material.accent);
    return [tile, Object.freeze({
      base: Object.freeze(base),
      accent: Object.freeze(accent),
      detail: Object.freeze(base.map((value, index) => (
        Math.round(value + (accent[index] - value) * 0.24)
      ))),
    })];
  }),
));

function wrapTexel(value) {
  return ((Math.floor(value) % 16) + 16) % 16;
}

export function sampleMaterial(tile, texX, texY) {
  const material = MATERIAL_RGB[tile] ?? MATERIAL_RGB[1];
  const x = wrapTexel(texX);
  const y = wrapTexel(texY);
  const base = material.base;
  const accent = material.accent;

  let patterned = false;
  if (tile === 1) patterned = (x * 5 + y * 3) % 13 === 0;
  if (tile === 2) patterned = x % 7 === 0 || (y === 2 && x % 3 === 0);
  if (tile === 3) {
    const mortar = y % 5 === 0;
    const staggeredJoint = (x + (Math.floor(y / 5) % 2) * 8) % 16 === 0;
    patterned = mortar || staggeredJoint;
  }
  if (tile === 4) {
    const seam = x === 1 || x === 14 || y === 1 || y === 14;
    const rivet = (x === 4 || x === 11) && (y === 4 || y === 11);
    patterned = seam || rivet;
  }

  if (!patterned) return base;
  if (tile === 1) return material.detail;
  return accent;
}

function freezeHandAnchor([x0, x1, y0, cuffY]) {
  return Object.freeze({ x0, x1, y0, cuffY });
}

function freezeWeaponHands(support, grip) {
  return Object.freeze({
    support: freezeHandAnchor(support),
    grip: freezeHandAnchor(grip),
  });
}

/**
 * Each visual exposes `muzzle` as a normalized offset relative to the weapon
 * frame (0..1 in both axes). The renderer places the muzzle-flash sprite at
 * that anchor so bullets visually originate from the barrel tip. Keep the tip
 * vertically centered on the slide to avoid bullets flying below the
 * crosshair.
 */
function freezeMuzzle(muzzle) {
  return Object.freeze({
    x: muzzle[0],
    y: muzzle[1],
  });
}

export const WEAPON_VISUALS = Object.freeze({
  pistol: Object.freeze({
    profile: 'sidearm', variant: 0,
    width: 50, height: 55, stanceX: 26,
    hands: freezeWeaponHands([0.18, 0.43, 0.69, 0.89], [0.62, 0.86, 0.74, 0.91]),
    body: PALETTE.GUNMETAL, metal: PALETTE.CONCRETE,
    grip: PALETTE.INK, accent: PALETTE.MUTED,
    muzzle: freezeMuzzle([0.06, 0.30]),
  }),
  usp: Object.freeze({
    profile: 'sidearm', variant: 1,
    width: 62, height: 54, stanceX: 25,
    hands: freezeWeaponHands([0.12, 0.32, 0.72, 0.90], [0.61, 0.83, 0.63, 0.88]),
    body: PALETTE.COAL, metal: PALETTE.GUNMETAL,
    grip: PALETTE.INK, accent: PALETTE.OLIVE,
    muzzle: freezeMuzzle([0.04, 0.28]),
  }),
  deagle: Object.freeze({
    profile: 'sidearm', variant: 2,
    width: 58, height: 59, stanceX: 23,
    hands: freezeWeaponHands([0.16, 0.37, 0.68, 0.88], [0.63, 0.86, 0.62, 0.87]),
    body: PALETTE.GUNMETAL, metal: PALETTE.DUST,
    grip: PALETTE.COAL, accent: PALETTE.SAND,
    muzzle: freezeMuzzle([0.05, 0.27]),
  }),
  uzi: Object.freeze({
    profile: 'smg', variant: 0,
    width: 62, height: 61, stanceX: 20,
    hands: freezeWeaponHands([0.19, 0.42, 0.70, 0.89], [0.61, 0.84, 0.75, 0.91]),
    body: PALETTE.COAL, metal: PALETTE.GUNMETAL,
    grip: PALETTE.INK, accent: PALETTE.OLIVE,
    muzzle: freezeMuzzle([0.04, 0.32]),
  }),
  ump45: Object.freeze({
    profile: 'smg', variant: 1,
    width: 76, height: 63, stanceX: 18,
    hands: freezeWeaponHands([0.10, 0.29, 0.64, 0.87], [0.57, 0.76, 0.68, 0.89]),
    body: PALETTE.GUNMETAL, metal: PALETTE.COAL,
    grip: PALETTE.INK, accent: PALETTE.CONCRETE,
    muzzle: freezeMuzzle([0.03, 0.30]),
  }),
  nova: Object.freeze({
    profile: 'shotgun', variant: 0,
    width: 96, height: 65, stanceX: 10,
    hands: freezeWeaponHands([0.27, 0.48, 0.61, 0.86], [0.61, 0.79, 0.64, 0.87]),
    body: PALETTE.GUNMETAL, metal: PALETTE.COAL,
    grip: PALETTE.RUST, accent: PALETTE.SAND,
    muzzle: freezeMuzzle([0.02, 0.30]),
  }),
  xm1014: Object.freeze({
    profile: 'shotgun', variant: 1,
    width: 92, height: 67, stanceX: 11,
    hands: freezeWeaponHands([0.22, 0.44, 0.63, 0.87], [0.58, 0.77, 0.66, 0.89]),
    body: PALETTE.COAL, metal: PALETTE.GUNMETAL,
    grip: PALETTE.INK, accent: PALETTE.OLIVE,
    muzzle: freezeMuzzle([0.02, 0.30]),
  }),
  famas: Object.freeze({
    profile: 'rifle', variant: 0,
    width: 83, height: 67, stanceX: 15,
    hands: freezeWeaponHands([0.17, 0.36, 0.60, 0.86], [0.57, 0.76, 0.65, 0.89]),
    body: PALETTE.GUNMETAL, metal: PALETTE.COAL,
    grip: PALETTE.INK, accent: PALETTE.CONCRETE,
    muzzle: freezeMuzzle([0.02, 0.31]),
  }),
  m4a1: Object.freeze({
    profile: 'rifle', variant: 1,
    width: 94, height: 66, stanceX: 12,
    hands: freezeWeaponHands([0.20, 0.40, 0.63, 0.87], [0.59, 0.78, 0.67, 0.90]),
    body: PALETTE.COAL, metal: PALETTE.GUNMETAL,
    grip: PALETTE.INK, accent: PALETTE.MUTED,
    muzzle: freezeMuzzle([0.02, 0.32]),
  }),
  ak47: Object.freeze({
    profile: 'rifle', variant: 2,
    width: 88, height: 68, stanceX: 14,
    hands: freezeWeaponHands([0.18, 0.43, 0.75, 0.91], [0.62, 0.86, 0.79, 0.93]),
    body: PALETTE.GUNMETAL, metal: PALETTE.COAL,
    grip: PALETTE.RUST, accent: PALETTE.SAND,
    muzzle: freezeMuzzle([0.02, 0.30]),
  }),
  scout: Object.freeze({
    profile: 'precision', variant: 0,
    width: 98, height: 62, stanceX: 9,
    hands: freezeWeaponHands([0.31, 0.49, 0.58, 0.84], [0.60, 0.77, 0.63, 0.87]),
    body: PALETTE.GUNMETAL, metal: PALETTE.INK,
    grip: PALETTE.OLIVE, accent: PALETTE.CONCRETE,
    muzzle: freezeMuzzle([0.02, 0.34]),
  }),
  awp: Object.freeze({
    profile: 'precision', variant: 1,
    width: 102, height: 63, stanceX: 8,
    hands: freezeWeaponHands([0.27, 0.47, 0.61, 0.86], [0.59, 0.76, 0.65, 0.88]),
    body: PALETTE.OLIVE, metal: PALETTE.INK,
    grip: PALETTE.GUNMETAL, accent: PALETTE.CONCRETE,
    muzzle: freezeMuzzle([0.02, 0.32]),
  }),
  knife: Object.freeze({
    profile: 'melee', variant: 0,
    width: 28, height: 56, stanceX: 30,
    hands: freezeWeaponHands([0.20, 0.40, 0.55, 0.85], [0.62, 0.84, 0.65, 0.90]),
    body: PALETTE.CONCRETE, metal: PALETTE.SAND,
    grip: PALETTE.RUST, accent: PALETTE.UI_AMBER,
    // 刀刃尖端，定位到上半身（< 0.5）。刀没有枪管火焰，但保留 muzzle
    // 锚点让 renderer 不会落入 pistol 后备。
    muzzle: freezeMuzzle([0.5, 0.15]),
  }),
});

export const UI_COPY = Object.freeze({
  mission: 'TACTICAL SIMULATION',
  sector: 'SECTOR // DUST-01',
  start: 'DEPLOY',
  buyTitle: 'EQUIPMENT REQUISITION',
  buyClose: 'B // CLOSE',
  health: 'VITALS',
  ammo: 'MAG',
  credits: 'CREDITS',
  headshot: 'HEADSHOT CONFIRMED',
  eliminated: 'TARGET NEUTRALIZED',
});
