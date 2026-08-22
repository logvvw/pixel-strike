/**
 * hud.js — HUD 更新
 */

import { getEffectiveSpread } from '../weapons/weapons.js';
import { UI_COPY } from './theme.js';

export function getCrosshairGap(weapon, movementIntensity = 0) {
  if (!weapon) return 3;
  const range = Math.max(0.0001, weapon.maxSpread - weapon.baseSpread);
  const effectiveSpread = getEffectiveSpread(weapon, movementIntensity);
  const normalized = Math.max(
    0,
    Math.min(1, (effectiveSpread - weapon.baseSpread) / range),
  );
  return Math.round(3 + normalized * 11);
}

export function getHealthState(percent) {
  if (percent <= 20) return 'critical';
  if (percent <= 60) return 'warning';
  return 'nominal';
}

export function getEquipmentRows(player) {
  const weapons = Array.isArray(player?.weapons) ? player.weapons : [];

  return weapons.map((weapon, index) => ({
    id: weapon.id,
    name: weapon.name,
    category: weapon.category,
    slot: index + 1,
    selected: player?.currentWeaponIdx === index,
  }));
}

export function getMapIdentityModel(definition) {
  const name = typeof definition?.name === 'string' && definition.name.trim()
    ? definition.name
    : '未知区域';
  const callout = typeof definition?.callout === 'string' && definition.callout.trim()
    ? definition.callout
    : 'UNLISTED';
  return { name, callout, label: `${name} // ${callout}` };
}

export function getOverlayModel(title, subtitle, buttonText, secondary = null) {
  const model = { title, subtitle, buttonText };
  if (secondary) model.secondary = { label: secondary.label, onClick: secondary.onClick };
  return model;
}

export class HUD {
  constructor() {
    this.elHealth = document.getElementById('health-fill');
    this.elHealthVal = document.getElementById('health-val');
    this.elAmmo = document.getElementById('ammo-display');
    this.elWeapon = document.getElementById('weapon-name');
    this.elScore = document.getElementById('score-display');
    this.elWave = document.getElementById('wave-display');
    this.elTimer = document.getElementById('timer-display');
    this.elMoney = document.getElementById('money-display');
    this.elMapName = document.getElementById('map-name-display');
    this.elMsg = document.getElementById('round-msg');
    this.elOverlay = document.getElementById('overlay');
    this.elBuyMenu = document.getElementById('buy-menu');
    this.elDamageFlash = document.getElementById('damage-flash') || null;
    this.elCrosshair = document.getElementById('crosshair');
    this.elHitMarker = document.getElementById('hit-marker');
    this.elKillFeed = document.getElementById('kill-feed');
    this.messageTimer = null;
    this.damageTimer = null;
  }

  update(player, feedback) {
    if (!this.elHealth) return;
    const pct = Math.max(0, player.health / player.maxHealth * 100);
    this.elHealth.style.width = pct + '%';
    this.elHealthVal.textContent = Math.ceil(player.health);

    const fill = this.elHealth;
    fill.classList.remove('nominal', 'warning', 'critical');
    fill.classList.add(getHealthState(pct));

    // 武器 & 弹药
    const w = player.currentWeapon;
    if (w) {
      this.elWeapon.textContent = w.name;
      this.elAmmo.textContent = w.reloading
        ? '换弹中...'
        : `${w.currentAmmo} / ${w.reserveAmmo === Infinity ? '∞' : w.reserveAmmo}`;
      this.elAmmo.classList.toggle('low', !w.reloading && w.currentAmmo <= Math.ceil(w.magazine * 0.25));
      this.elAmmo.classList.toggle('empty', !w.reloading && w.currentAmmo === 0);
      this.elCrosshair?.style.setProperty(
        '--spread',
        `${getCrosshairGap(w, player.movementIntensity)}px`,
      );
    }

    if (this.elHitMarker) {
      this.elHitMarker.className = feedback?.hitMarker
        ? `visible ${feedback.hitMarker}`
        : '';
    }

    // 分数 & 波次
    this.elScore.textContent = `SCORE // ${String(player.score).padStart(5, '0')}`;
    this.elWave.textContent = `CONTACT // ${String(player.wave ?? 1).padStart(2, '0')}`;
    this.elMoney.textContent = `${UI_COPY.credits} // $${player.money}`;
  }

  showMsg(text, duration = 2000) {
    if (!this.elMsg) return;
    this.elMsg.classList.remove('is-hidden');
    this.elMsg.textContent = text;
    this.elMsg.style.animation = 'none';
    this.elMsg.offsetHeight; // 触发 reflow
    this.elMsg.style.animation = '';
    clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => {
      this.elMsg.classList.add('is-hidden');
    }, duration);
  }

  /** Show a message that stays visible until hideMsg() is called. */
  showMsgPersistent(text) {
    if (!this.elMsg) return;
    clearTimeout(this.messageTimer);
    this.messageTimer = null;
    this.elMsg.classList.remove('is-hidden');
    this.elMsg.textContent = text;
  }

  /** Hide the active round message / persistent state (e.g. PAUSED). */
  hideMsg() {
    if (!this.elMsg) return;
    clearTimeout(this.messageTimer);
    this.messageTimer = null;
    this.elMsg.classList.add('is-hidden');
  }

  showOverlay(title, subtitle, buttonText, onClick, secondary = null) {
    if (!this.elOverlay) return;
    const model = getOverlayModel(title, subtitle, buttonText, secondary);
    const eyebrow = document.createElement('span');
    eyebrow.className = 'overlay-eyebrow';
    eyebrow.textContent = 'AFTER ACTION REPORT';
    const heading = document.createElement('h2');
    heading.textContent = model.title;
    const detail = document.createElement('p');
    detail.textContent = model.subtitle;
    const primaryButton = document.createElement('button');
    primaryButton.id = 'overlay-btn';
    primaryButton.type = 'button';
    primaryButton.textContent = model.buttonText;
    primaryButton.onclick = onClick;
    const children = [eyebrow, heading, detail, primaryButton];
    if (model.secondary) {
      const secondaryButton = document.createElement('button');
      secondaryButton.id = 'overlay-secondary-btn';
      secondaryButton.type = 'button';
      secondaryButton.textContent = model.secondary.label;
      secondaryButton.onclick = model.secondary.onClick;
      children.push(secondaryButton);
    }
    this.elOverlay.replaceChildren(...children);
    this.elOverlay.classList.remove('is-hidden');
  }

  hideOverlay() {
    this.elOverlay?.classList.add('is-hidden');
  }

  flashDamage() {
    if (!this.elDamageFlash) return;
    this.elDamageFlash.style.opacity = '1';
    clearTimeout(this.damageTimer);
    this.damageTimer = setTimeout(() => {
      this.elDamageFlash.style.opacity = '0';
    }, 150);
  }

  showKillFeed(weaponName, isHeadshot = false) {
    if (!this.elKillFeed) return;
    const row = document.createElement('div');
    row.className = `kill-row${isHeadshot ? ' headshot' : ''}`;
    row.textContent = `YOU  [${weaponName}]  TARGET${isHeadshot ? '  HEADSHOT' : ''}`;
    this.elKillFeed.prepend(row);
    while (this.elKillFeed.children.length > 4) {
      this.elKillFeed.lastElementChild.remove();
    }
    setTimeout(() => row.remove(), 1800);
  }

  resetCombatFeedback() {
    if (this.elHitMarker) this.elHitMarker.className = '';
    if (this.elKillFeed) this.elKillFeed.replaceChildren();
  }

  setMapIdentity(definition) {
    const model = getMapIdentityModel(definition);
    if (!this.elMapName) return model;
    this.elMapName.textContent = model.label;
    this.elMapName.setAttribute('aria-label', `当前地图 ${model.label}`);
    return model;
  }

  showBuyMenu(player) {
    if (!this.elBuyMenu) return;
    this.elBuyMenu.classList.remove('is-hidden');
    this._renderBuyList(player);
  }

  hideBuyMenu() {
    this.elBuyMenu?.classList.add('is-hidden');
  }

  _renderBuyList(player) {
    const list = document.getElementById('buy-list');
    if (!list) return;

    const rows = getEquipmentRows(player).map(item => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `buy-item field-armory-row${item.selected ? ' selected' : ''}`;
      row.dataset.id = item.id;
      row.setAttribute('aria-pressed', String(item.selected));
      row.onclick = () => this._selectWeapon(item.id);

      const indexLabel = document.createElement('span');
      indexLabel.className = 'buy-index';
      indexLabel.textContent = String(item.slot).padStart(2, '0');
      const identity = document.createElement('span');
      identity.className = 'buy-identity';
      const name = document.createElement('strong');
      name.textContent = item.name;
      const category = document.createElement('small');
      category.textContent = item.category;
      identity.append(name, category);
      row.append(indexLabel, identity);
      return row;
    });
    list.replaceChildren(...rows);
  }

  _selectWeapon(id) {
    window.__pixstrike_game?.selectWeaponById?.(id);
  }
}
