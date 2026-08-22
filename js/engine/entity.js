/**
 * entity.js — 实体管理（敌人、道具）
 */

import { isWall } from './map.js';

const ENEMY_SPEED = 1.2;    // 地图单位/秒
const ENEMY_DAMAGE = 8;     // 每次攻击伤害
const ENEMY_ATTACK_RANGE = 1.5;
const ENEMY_ATTACK_COOLDOWN = 1000; // ms

export class Entity {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 'enemy', 'bomb', 'ammo', 'health'
    this.alive = true;
    this.visible = true;
    this.hitFlash = 0; // 受击闪烁帧
    this.radius = type === 'enemy' ? 0.3 : 0.15;
    this.damage = 0;
    this.headshot = false;

    // 敌人专属
    if (type === 'enemy') {
      this.health = 35;
      this.maxHealth = 35;
      this.speed = ENEMY_SPEED;
      this.lastAttack = 0;
      this.state = 'chase'; // chase, attack, idle
      this.targetX = x;
      this.targetY = y;
    }
  }

  takeDamage(amount, isHeadshot = false) {
    if (!this.alive) return;
    const actualDmg = isHeadshot ? amount * 2 : amount;
    this.health -= actualDmg;
    this.hitFlash = 6; // 闪烁 6 帧

    if (this.health <= 0) {
      this.alive = false;
      this.visible = false;
    }
  }

  update(dt, player, map) {
    if (!this.alive) return;
    if (this.hitFlash > 0) this.hitFlash--;

    if (this.type !== 'enemy') return;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 视野检测
    const canSee = dist < 15 && hasLineOfSight(this.x, this.y, player.x, player.y, map);

    if (!canSee) {
      // 向最后已知位置移动
      this.moveToward(this.targetX, this.targetY, dt, map);
      return;
    }

    if (dist < ENEMY_ATTACK_RANGE) {
      // 攻击玩家
      const now = performance.now();
      if (now - this.lastAttack > ENEMY_ATTACK_COOLDOWN) {
        this.lastAttack = now;
        return { type: 'attack', damage: ENEMY_DAMAGE };
      }
    } else {
      // 追击玩家
      this.moveToward(player.x, player.y, dt, map);
    }

    return null;
  }

  moveToward(tx, ty, dt, map) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.1) return;

    const nx = dx / dist;
    const ny = dy / dist;
    const speed = this.speed * dt;
    const newX = this.x + nx * speed;
    const newY = this.y + ny * speed;

    // 简单碰撞
    if (!isWall(map, newX, this.y)) this.x = newX;
    if (!isWall(map, this.x, newY)) this.y = newY;
  }
}

function hasLineOfSight(x0, y0, x1, y1, map) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(dist * 3);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + dx * t;
    const y = y0 + dy * t;
    if (isWall(map, x, y)) return false;
  }
  return true;
}
