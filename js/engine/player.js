/**
 * player.js — 玩家状态与移动
 */

import { isWall } from './map.js';

const PLAYER_RADIUS = 0.2;
const MOVE_SPEED = 3.0;    // 地图单位/秒
const CROUCH_SPEED = 1.7;  // 地图单位/秒（下蹲时更慢）
const ROT_SPEED = 2.5;     // 弧度/秒（键盘旋转）
const MOUSE_SENSITIVITY = 0.002;

// Crouched view: lower the eye line so the world feels closer to the ground.
const CROUCH_PITCH = 7;
// Jump: a short 0-1-0 parabola over JUMP_DURATION that lifts the eye line.
const JUMP_DURATION = 0.36;
const JUMP_HEIGHT = 12;

function easeOutParabola(t) {
  // t in [0,1]; returns 0 at both ends, max at t=0.5.
  return 4 * t * (1 - t);
}

export class Player {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.angle = angle;   // 朝向角（弧度）
    this.health = 100;
    this.maxHealth = 100;
    this.money = 800;
    this.score = 0;
    this.dead = false;
    this.weapons = [];
    this.currentWeaponIdx = 0;
    this.movementIntensity = 0;
    this.weaponBob = 0;
    this.bobTime = 0;
    this.recoilX = 0;
    this.recoilY = 0;
    this.cameraPitch = 0;

    // Movement / stance state.
    this.crouching = false;
    this.jumpActive = false;
    this.jumpTime = 0;
  }

  get currentWeapon() {
    return this.weapons[this.currentWeaponIdx];
  }

  get cameraOffset() {
    const crouchOffset = this.crouching ? CROUCH_PITCH : 0;
    const jumpLift = this.jumpActive
      ? -easeOutParabola(this.jumpTime / JUMP_DURATION) * JUMP_HEIGHT
      : 0;
    return Math.max(
      -24 + jumpLift,
      Math.min(24, this.cameraPitch + this.recoilY * 4 + crouchOffset + jumpLift),
    );
  }

  /** Trigger a jump. Returns false if already airborne or dead. */
  jump() {
    if (this.dead || this.jumpActive) return false;
    this.jumpActive = true;
    this.jumpTime = 0;
    return true;
  }

  /** 移动并处理碰撞 */
  move(dt, input, map) {
    if (this.dead) return;
    const startX = this.x;
    const startY = this.y;

    // 鼠标旋转
    this.applyLookDelta(
      input.consumeMouseX(),
      input.consumeMouseY?.() ?? 0,
    );

    // 键盘旋转（备用）
    if (input.isHeld('ArrowLeft')) this.angle -= ROT_SPEED * dt;
    if (input.isHeld('ArrowRight')) this.angle += ROT_SPEED * dt;

    // 下蹲状态（按住 Shift）
    this.crouching = input.isHeld('ShiftLeft') || input.isHeld('ShiftRight');

    // 跳跃进度推进
    if (this.jumpActive) {
      this.jumpTime += dt;
      if (this.jumpTime >= JUMP_DURATION) {
        this.jumpTime = 0;
        this.jumpActive = false;
      }
    }

    // 计算移动方向
    let moveX = 0, moveY = 0;
    const forward = input.isHeld('KeyW') || input.isHeld('ArrowUp');
    const backward = input.isHeld('KeyS') || input.isHeld('ArrowDown');
    const strafeLeft = input.isHeld('KeyA');
    const strafeRight = input.isHeld('KeyD');

    if (forward) { moveX += Math.cos(this.angle); moveY += Math.sin(this.angle); }
    if (backward) { moveX -= Math.cos(this.angle); moveY -= Math.sin(this.angle); }
    if (strafeLeft) { moveX += Math.cos(this.angle - Math.PI/2); moveY += Math.sin(this.angle - Math.PI/2); }
    if (strafeRight) { moveX += Math.cos(this.angle + Math.PI/2); moveY += Math.sin(this.angle + Math.PI/2); }

    // 归一化
    const len = Math.sqrt(moveX * moveX + moveY * moveY);
    if (len > 0) { moveX /= len; moveY /= len; }

    const baseSpeed = this.crouching ? CROUCH_SPEED : MOVE_SPEED;
    const speed = baseSpeed * dt;
    const newX = this.x + moveX * speed;
    const newY = this.y + moveY * speed;

    // 碰撞检测（X 和 Y 分开，允许贴墙滑动）
    if (!this.collidesWithWall(newX, this.y, map)) {
      this.x = newX;
    }
    if (!this.collidesWithWall(this.x, newY, map)) {
      this.y = newY;
    }

    const displacement = Math.hypot(this.x - startX, this.y - startY);
    const movementRatio = speed > 0 ? displacement / speed : 0;
    this.movementIntensity = movementRatio > 0.999
      ? 1
      : Math.min(1, movementRatio);
    if (this.movementIntensity > 0) {
      this.bobTime += dt * 9 * this.movementIntensity;
      this.weaponBob = Math.sin(this.bobTime) * 1.5 * this.movementIntensity;
    } else {
      this.weaponBob *= Math.max(0, 1 - dt * 10);
    }
  }

  applyWeaponRecoil(recoil) {
    if (!recoil) return;
    this.angle += recoil.x;
    this.recoilX += recoil.x;
    this.recoilY += recoil.y;
  }

  applyLookDelta(mouseX, mouseY) {
    this.angle += mouseX * MOUSE_SENSITIVITY;
    this.cameraPitch = Math.max(
      -20,
      Math.min(20, this.cameraPitch - mouseY * 0.06),
    );
  }

  updateWeaponHandling(dt) {
    const recovery = Math.min(1, dt * 8);
    this.recoilX += (0 - this.recoilX) * recovery;
    this.recoilY += (0 - this.recoilY) * recovery;
  }

  collidesWithWall(x, y, map) {
    const r = this.crouching ? PLAYER_RADIUS * 0.7 : PLAYER_RADIUS;
    // 检查周围 4 个方向的碰撞点
    const points = [
      [x - r, y - r], [x + r, y - r],
      [x - r, y + r], [x + r, y + r],
      [x, y - r], [x, y + r], [x - r, y], [x + r, y]
    ];
    for (const [px, py] of points) {
      if (isWall(map, px, py)) return true;
    }
    return false;
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this.dead = true;
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }
}
