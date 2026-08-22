/**
 * 与 DOM/Canvas 解耦的短时战斗反馈状态。
 * 所有计时使用秒，确保不同刷新率下表现一致。
 */
export class CombatFeedback {
  constructor() {
    this.reset();
  }

  onShot(shot) {
    if (!shot?.fired) return;
    const kick = shot.recoil?.kick ?? 0.5;
    this.muzzle = 0.055;
    this.muzzleFrame++;
    this.weaponKick = Math.max(this.weaponKick, kick);
    this.screenKick = Math.max(this.screenKick, kick * 0.35);
  }

  onHit(kind = 'hit') {
    this.hitMarker = kind;
    this.hitMarkerTime = kind === 'headshot' ? 0.17 : 0.11;
  }

  onKill(isHeadshot = false) {
    this.hitMarker = isHeadshot ? 'headshot-kill' : 'kill';
    this.hitMarkerTime = 0.22;
    this.killPulse = 1;
  }

  update(dt) {
    this.muzzle = Math.max(0, this.muzzle - dt);
    this.hitMarkerTime = Math.max(0, this.hitMarkerTime - dt);
    if (this.hitMarkerTime === 0) this.hitMarker = null;
    this.weaponKick = Math.max(0, this.weaponKick - dt * 7);
    this.screenKick = Math.max(0, this.screenKick - dt * 9);
    this.killPulse = Math.max(0, this.killPulse - dt * 4);
    if (this.wallSpark) {
      this.wallSpark.time = Math.max(0, this.wallSpark.time - dt);
      if (this.wallSpark.time === 0) this.wallSpark = null;
    }
  }

  reset() {
    this.muzzle = 0;
    this.muzzleFrame = 0;
    this.weaponKick = 0;
    this.screenKick = 0;
    this.hitMarker = null;
    this.hitMarkerTime = 0;
    this.killPulse = 0;
    this.wallSpark = null;
  }
}
