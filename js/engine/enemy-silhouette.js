/**
 * Shared normalized enemy silhouette used by rendering and hit detection.
 *
 * The silhouette follows the classic LEGO minifigure proportions:
 *  - head sits on the shoulders, a separate C-shaped clamp
 *  - torso (vest) is the wide center block
 *  - short arms hang straight down at the sides, ending in claw hands
 *  - short legs and boots occupy the bottom third
 *
 * Horizontal (sx) and vertical (sy) coordinates are normalized to [0, 1]
 * across the sprite bounding box. Renderer and hit detection both use this
 * single source of truth so a bullet that lands on a hand will not register
 * as a headshot.
 */
export function getEnemyPart(sx, sy) {
  // Head + face: classic minifigure "C" clamp, narrower than torso.
  const helmet = sy > 0.01 && sy < 0.10 && sx > 0.32 && sx < 0.68;
  const face = sy >= 0.10 && sy < 0.24 && sx > 0.35 && sx < 0.65;
  const eyeLine = sy >= 0.15 && sy < 0.18 && sx > 0.38 && sx < 0.62;
  // Neck stub between head and torso.
  const neck = sy >= 0.24 && sy < 0.28 && sx > 0.42 && sx < 0.58;
  // Torso: a wide rectangle with a slight taper, the iconic LEGO chest.
  const shoulders = sy >= 0.27 && sy < 0.36 && sx > 0.16 && sx < 0.84;
  const vest = sy >= 0.28 && sy < 0.58 && sx > 0.22 && sx < 0.78;
  const webbing = sy >= 0.39 && sy < 0.43 && sx > 0.23 && sx < 0.77;
  // Arms hang straight down from the shoulders.
  const backArm = sy >= 0.34 && sy < 0.50 && sx > 0.04 && sx < 0.18;
  const frontArm = sy >= 0.34 && sy < 0.50 && sx > 0.82 && sx < 0.96;
  const backHand = sy >= 0.49 && sy < 0.58 && sx > 0.04 && sx < 0.18;
  const frontHand = sy >= 0.49 && sy < 0.58 && sx > 0.82 && sx < 0.96;
  const weaponArm = sy >= 0.40 && sy < 0.50 && sx > 0.60 && sx < 0.82;
  // Hip plate — the LEGO minifigure has a narrow waist block between the
  // torso and the legs.
  const hips = sy >= 0.58 && sy < 0.66 && sx > 0.30 && sx < 0.70;
  // Two short legs split down the middle.
  const leftLeg = sy >= 0.66 && sy < 0.94 && sx > 0.28 && sx < 0.46;
  const rightLeg = sy >= 0.66 && sy < 0.94 && sx > 0.54 && sx < 0.72;
  // Boots cap the legs with a thicker sole.
  const boots = sy >= 0.90 && sy < 1
    && ((sx > 0.24 && sx < 0.48) || (sx > 0.52 && sx < 0.76));

  let part = null;
  if (shoulders) part = 'uniform';
  if (hips) part = 'hips';
  if (vest) part = 'vest';
  if (webbing) part = 'webbing';
  if (weaponArm) part = 'weapon';
  if (frontHand) part = 'hand';
  if (backHand) part = 'hand';
  if (frontArm) part = 'arm';
  if (backArm) part = 'arm';
  if (leftLeg || rightLeg) part = 'legs';
  if (face) part = 'face';
  if (helmet) part = 'helmet';
  if (eyeLine) part = 'eye';
  if (boots) part = 'boots';
  if (neck) part = 'neck';
  return part;
}

export function isEnemyHeadPart(part) {
  return part === 'helmet' || part === 'face' || part === 'eye';
}
