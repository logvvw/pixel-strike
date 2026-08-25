import { getMapDefinition, MAP_CATALOG, MAP_SERIES } from '../maps/catalog.js';
import { generateMap } from '../maps/generator.js';
import { WEAPONS } from '../weapons/weapons.js';
import { renderWeaponThumbnail } from './weapon-thumbnail.js';

const DIFFICULTY_LABELS = Object.freeze({
  1: '新兵',
  2: '常规',
  3: '老兵',
  4: '专家',
});

const seriesIds = new Set(MAP_SERIES.map(series => series.id));
const STATUS_TONES = new Set(['neutral', 'success', 'warning', 'error']);

const PREVIEW_COLORS = Object.freeze({
  0: '#232721',
  1: '#777468',
  2: '#59604a',
  3: '#8a4f36',
  4: '#a69a7b',
  5: '#e3b341',
  6: '#c2b28c',
  7: '#87a36f',
  8: '#c65343',
});

function profileIds(profile, field) {
  return new Set(Array.isArray(profile?.[field]) ? profile[field] : []);
}

export function normalizeStatusTone(tone) {
  return STATUS_TONES.has(tone) ? tone : 'neutral';
}

export function getProfileActionStatus(action, result, subjectName = '') {
  if (result?.ok && result.saved === false) {
    return { message: '进度已更新，但本次可能无法保存', tone: 'warning' };
  }

  if (action === 'purchase') {
    if (result?.ok) return { message: `已解锁 ${subjectName}`, tone: 'success' };
    if (result?.reason === 'owned') return { message: '已拥有该武器', tone: 'neutral' };
    if (result?.reason === 'insufficient-funds') return { message: '军械点数不足', tone: 'warning' };
    if (result?.reason === 'unknown') return { message: '未知武器', tone: 'error' };
  }

  if (action === 'equip') {
    if (result?.ok && result.equipped === true) {
      return { message: `已装备 ${subjectName}`, tone: 'success' };
    }
    if (result?.ok && result.equipped === false) {
      return { message: `已卸下 ${subjectName}`, tone: 'neutral' };
    }
    if (result?.reason === 'not-owned') return { message: '请先购买该武器', tone: 'warning' };
    if (result?.reason === 'full') return { message: '装备槽已满', tone: 'warning' };
    if (result?.reason === 'last-equipped') {
      return { message: '至少保留一把出战武器', tone: 'warning' };
    }
  }

  if (action === 'map') {
    if (result?.ok) return { message: '地图已选择', tone: 'success' };
    if (result?.reason === 'unknown') return { message: '未知地图', tone: 'error' };
  }

  return { message: '操作未完成', tone: 'error' };
}

export function getNextMapFocusIndex(currentIndex, key, count) {
  if (count <= 0) return -1;
  if (key === 'ArrowLeft' || key === 'ArrowUp') {
    return currentIndex <= 0 ? count - 1 : currentIndex - 1;
  }
  if (key === 'ArrowRight' || key === 'ArrowDown') {
    return currentIndex >= count - 1 ? 0 : currentIndex + 1;
  }
  return Math.min(Math.max(currentIndex, 0), count - 1);
}

function weaponPresentation(weapon) {
  return {
    id: weapon.id,
    name: weapon.name,
    category: weapon.category,
    unlockPrice: weapon.unlockPrice,
    display: { ...weapon.display },
    description: weapon.description,
  };
}

export function getMapCardModels(profile, filter = 'all') {
  const activeFilter = seriesIds.has(filter) ? filter : 'all';
  return MAP_CATALOG
    .filter(map => activeFilter === 'all' || map.series === activeFilter)
    .map(map => ({
      id: map.id,
      series: map.series,
      name: map.name,
      callout: map.callout,
      description: map.description,
      difficulty: map.difficulty,
      difficultyLabel: `难度 ${map.difficulty} // ${DIFFICULTY_LABELS[map.difficulty] ?? '未知'}`,
      dimensions: `${map.width} × ${map.height}`,
      tags: [...map.tags],
      selected: map.id === profile?.selectedMapId,
    }));
}

export function getStoreCardModels(profile) {
  const ownedIds = profileIds(profile, 'ownedWeaponIds');
  const credits = Number.isFinite(profile?.credits) ? Math.max(0, profile.credits) : 0;

  return Object.values(WEAPONS).map(weapon => {
    const owned = ownedIds.has(weapon.id);
    const affordable = !owned && credits >= weapon.unlockPrice;
    return {
      ...weaponPresentation(weapon),
      owned,
      affordable,
      locked: !owned && !affordable,
    };
  });
}

export function getArmoryCardModels(profile) {
  const ownedIds = profileIds(profile, 'ownedWeaponIds');
  const equippedIds = Array.isArray(profile?.equippedWeaponIds)
    ? profile.equippedWeaponIds
    : [];
  const equippedSet = new Set(equippedIds);
  const canAdd = equippedIds.length < 4;
  const canSubtract = equippedIds.length > 1;

  return Object.values(WEAPONS)
    .filter(weapon => ownedIds.has(weapon.id))
    .map(weapon => {
      const equipped = equippedSet.has(weapon.id);
      return {
        ...weaponPresentation(weapon),
        equipped,
        slot: equipped ? equippedIds.indexOf(weapon.id) + 1 : null,
        canEquip: !equipped && canAdd,
        canRemove: equipped && canSubtract,
      };
    });
}

export function renderPreviewToCanvas(canvas, grid) {
  if (!canvas || !Array.isArray(grid) || grid.length === 0) return;
  const columns = Array.isArray(grid[0]) ? grid[0].length : 0;
  if (columns === 0 || typeof canvas.getContext !== 'function') return;
  const context = canvas.getContext('2d');
  if (!context) return;

  const cellWidth = canvas.width / columns;
  const cellHeight = canvas.height / grid.length;
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < grid.length; y++) {
    const row = Array.isArray(grid[y]) ? grid[y] : [];
    for (let x = 0; x < columns; x++) {
      context.fillStyle = PREVIEW_COLORS[row[x]] ?? PREVIEW_COLORS[0];
      context.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
    }
  }
}

const TAB_IDS = Object.freeze(['maps', 'armory', 'store']);
const STAT_LABELS = Object.freeze({
  power: '威力',
  rate: '射速',
  accuracy: '精度',
  control: '操控',
  capacity: '弹容',
});

function callbackOrNoop(callback) {
  return typeof callback === 'function' ? callback : () => {};
}

export class OperationsHub {
  constructor({
    onDeploy,
    onPurchase,
    onToggleEquip,
    onSelectMap,
    sound = null,
  } = {}) {
    this.onDeploy = callbackOrNoop(onDeploy);
    this.onPurchase = callbackOrNoop(onPurchase);
    this.onToggleEquip = callbackOrNoop(onToggleEquip);
    this.onSelectMap = callbackOrNoop(onSelectMap);
    this.sound = sound && typeof sound.select === 'function' ? sound : null;
    this.activeTab = 'maps';
    this.mapFilter = 'all';
    this.profile = null;

    this.document = typeof document === 'undefined' ? null : document;
    this.root = this.document?.getElementById('boot-screen') ?? null;
    this.elements = this._collectElements();
    this.listenersInstalled = false;
    this._installListeners();
  }

  _collectElements() {
    if (!this.root) return {};
    const find = selector => this.root.querySelector(selector);
    return {
      tabs: find('#ops-tabs'),
      filters: find('#map-filters'),
      mapList: find('#map-list'),
      armoryList: find('#armory-list'),
      storeList: find('#store-list'),
      loadoutSlots: find('#loadout-slots'),
      credits: find('#profile-credits'),
      kills: find('#profile-kills'),
      status: find('#ops-status'),
      detailTitle: find('#map-detail-title'),
      detailCallout: find('#map-detail-callout'),
      detailDescription: find('#map-detail-description'),
      detailMeta: find('#map-detail-meta'),
      detailTags: find('#map-detail-tags'),
      preview: find('#map-preview'),
      deploy: find('#start-btn'),
    };
  }

  _installListeners() {
    if (!this.root || this.listenersInstalled) return;
    this.listenersInstalled = true;

    this.elements.tabs?.addEventListener('click', event => {
      const button = event.target.closest('button[data-tab]');
      if (button && this.elements.tabs.contains(button)) this._setTab(button.dataset.tab);
    });

    this.elements.filters?.addEventListener('click', event => {
      const button = event.target.closest('button[data-filter]');
      if (!button || !this.elements.filters.contains(button)) return;
      this.mapFilter = seriesIds.has(button.dataset.filter) ? button.dataset.filter : 'all';
      this._renderMaps();
    });

    this.elements.mapList?.addEventListener('click', event => {
      const card = event.target.closest('button[data-map-id]');
      if (card && this.elements.mapList.contains(card)) {
        this.onSelectMap(card.dataset.mapId);
        this.sound?.select?.();
      }
    });

    this.elements.mapList?.addEventListener('keydown', event => {
      const cards = [...this.elements.mapList.querySelectorAll('button[data-map-id]')];
      const card = event.target.closest('button[data-map-id]');
      if (!card || !cards.includes(card)) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        this.onSelectMap(card.dataset.mapId);
        this.sound?.select?.();
        return;
      }
      if (!event.key.startsWith('Arrow')) return;
      event.preventDefault();
      cards[getNextMapFocusIndex(cards.indexOf(card), event.key, cards.length)]?.focus();
    });

    this.elements.armoryList?.addEventListener('click', event => {
      const button = event.target.closest('button[data-action="toggle-equip"]');
      if (button && this.elements.armoryList.contains(button) && !button.disabled) {
        this.onToggleEquip(button.dataset.weaponId);
      }
    });

    this.elements.storeList?.addEventListener('click', event => {
      const button = event.target.closest('button[data-action="purchase"]');
      if (button && this.elements.storeList.contains(button) && !button.disabled) {
        this.onPurchase(button.dataset.weaponId);
      }
    });

    this.elements.deploy?.addEventListener('click', () => {
      const selectedMapId = this.profile?.selectedMapId;
      if (selectedMapId) this.onDeploy(selectedMapId);
    });

    this.root.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || this.activeTab === 'maps') return;
      event.preventDefault();
      this._setTab('maps');
      this.elements.tabs?.querySelector('[data-tab="maps"]')?.focus();
    });
  }

  show(profile) {
    this.root?.classList.remove('is-hidden');
    this.refresh(profile);
    this._setTab(this.activeTab);
  }

  hide() {
    this.root?.classList.add('is-hidden');
  }

  refresh(profile = this.profile) {
    this.profile = profile;
    if (!this.root) return;

    if (this.elements.credits) {
      const credits = Number.isFinite(profile?.credits) ? Math.max(0, Math.floor(profile.credits)) : 0;
      this.elements.credits.textContent = credits.toLocaleString('en-US');
    }
    if (this.elements.kills) {
      const kills = Number.isFinite(profile?.totalKills) ? Math.max(0, Math.floor(profile.totalKills)) : 0;
      this.elements.kills.textContent = kills.toLocaleString('en-US');
    }

    this._renderMaps();
    this._renderMapDetail();
    this._renderArmory();
    this._renderStore();
    this._setTab(this.activeTab);
  }

  setStatus(message, tone = 'neutral') {
    const status = this.elements.status;
    if (!status) return;
    status.textContent = String(message ?? '');
    status.dataset.tone = normalizeStatusTone(tone);
  }

  _setTab(tab) {
    this.activeTab = TAB_IDS.includes(tab) ? tab : 'maps';
    if (!this.root) return;

    for (const button of this.elements.tabs?.querySelectorAll('button[data-tab]') ?? []) {
      const active = button.dataset.tab === this.activeTab;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    }
    for (const panel of this.root.querySelectorAll('.ops-panel')) {
      panel.classList.toggle('is-hidden', panel.id !== `ops-panel-${this.activeTab}`);
    }
  }

  _create(tagName, className, text) {
    const element = this.document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  _renderMaps() {
    if (!this.elements.mapList) return;
    const models = getMapCardModels(this.profile, this.mapFilter);
    const cards = models.map(model => {
      const card = this._create('button', 'map-card');
      card.type = 'button';
      card.dataset.mapId = model.id;
      card.classList.toggle('is-selected', model.selected);
      card.setAttribute('aria-pressed', String(model.selected));
      card.tabIndex = model.selected ? 0 : -1;

      const index = this._create('span', 'map-card-index', String(MAP_CATALOG.findIndex(map => map.id === model.id) + 1).padStart(2, '0'));
      const copy = this._create('span', 'map-card-copy');
      copy.append(
        this._create('strong', '', model.name),
        this._create('small', '', `${model.callout} // ${model.dimensions}`),
      );
      const difficulty = this._create('span', 'map-card-difficulty', model.difficultyLabel);
      card.append(index, copy, difficulty);
      return card;
    });

    if (cards.length > 0 && !cards.some(card => card.tabIndex === 0)) cards[0].tabIndex = 0;
    this.elements.mapList.replaceChildren(...cards);
    for (const button of this.elements.filters?.querySelectorAll('button[data-filter]') ?? []) {
      button.setAttribute('aria-pressed', String(button.dataset.filter === this.mapFilter));
    }
  }

  _renderMapDetail() {
    const model = getMapCardModels(this.profile).find(map => map.selected)
      ?? getMapCardModels(this.profile)[0];
    if (!model) return;

    if (this.elements.detailTitle) this.elements.detailTitle.textContent = model.name;
    if (this.elements.detailCallout) this.elements.detailCallout.textContent = model.callout;
    if (this.elements.detailDescription) this.elements.detailDescription.textContent = model.description;
    if (this.elements.detailMeta) {
      this.elements.detailMeta.textContent = `${model.difficultyLabel} · ${model.dimensions}`;
    }
    if (this.elements.detailTags) {
      this.elements.detailTags.replaceChildren(...model.tags.map(tag => this._create('li', '', tag)));
    }
    renderPreviewToCanvas(this.elements.preview, generateMap(getMapDefinition(model.id)));
  }

  _createWeaponCard(model, mode) {
    const state = mode === 'store'
      ? (model.owned ? 'is-owned' : model.locked ? 'is-locked' : 'is-affordable')
      : (model.equipped ? 'is-equipped' : 'is-available');
    const card = this._create('article', `weapon-card ${state}`);

    const header = this._create('header', 'weapon-card-header');
    const identity = this._create('div', 'weapon-identity');
    identity.append(
      this._create('span', '', model.category),
      this._create('h3', '', model.name),
    );
    const markerText = mode === 'store'
      ? (model.owned ? 'OWNED' : `${model.unlockPrice.toLocaleString('en-US')} CR`)
      : (model.equipped ? `SLOT ${model.slot}` : 'RESERVE');
    header.append(identity, this._create('strong', 'weapon-state', markerText));

    const stats = this._create('dl', 'weapon-stats');
    for (const [stat, value] of Object.entries(model.display)) {
      const row = this._create('div', 'weapon-stat');
      row.append(this._create('dt', '', STAT_LABELS[stat] ?? stat));
      const meter = this._create('dd', 'stat-track');
      meter.dataset.level = String(Math.max(0, Math.min(10, Math.round(value / 10))));
      meter.setAttribute('aria-label', `${STAT_LABELS[stat] ?? stat} ${value}%`);
      meter.append(this._create('span', 'stat-fill'));
      row.append(meter);
      stats.append(row);
    }

    const action = this._create('button', 'weapon-action');
    action.type = 'button';
    action.dataset.weaponId = model.id;
    if (mode === 'store') {
      action.dataset.action = 'purchase';
      action.disabled = !model.affordable;
      action.textContent = model.owned ? '已拥有 // OWNED' : model.locked ? '信用点不足 // LOCKED' : '解锁武器 // PURCHASE';
    } else {
      action.dataset.action = 'toggle-equip';
      action.disabled = model.equipped ? !model.canRemove : !model.canEquip;
      action.textContent = model.equipped ? '移出装备 // REMOVE' : '加入装备 // EQUIP';
    }

    // 小型像素缩略图：用 canvas 在卡片内画出武器轮廓（与游戏内 renderer 同源）。
    // 尺寸固定 96×64 像素（CSS 放大显示），所有武器按比例居中——保留网格一致。
    const thumb = this._create('canvas', 'weapon-thumb');
    thumb.width = 96;
    thumb.height = 64;
    thumb.setAttribute('aria-label', `${model.name} 缩略图`);
    renderWeaponThumbnail(thumb, model.id);

    card.append(header, thumb, this._create('p', 'weapon-description', model.description), stats, action);
    return card;
  }

  _renderArmory() {
    if (!this.elements.armoryList) return;
    const models = getArmoryCardModels(this.profile);
    this.elements.armoryList.replaceChildren(...models.map(model => this._createWeaponCard(model, 'armory')));

    const equippedIds = Array.isArray(this.profile?.equippedWeaponIds)
      ? this.profile.equippedWeaponIds.slice(0, 4)
      : [];
    const slots = Array.from({ length: 4 }, (_, index) => {
      const weapon = WEAPONS[equippedIds[index]];
      return this._create('li', weapon ? 'is-filled' : '', `${String(index + 1).padStart(2, '0')} // ${weapon?.name ?? 'EMPTY'}`);
    });
    this.elements.loadoutSlots?.replaceChildren(...slots);
  }

  _renderStore() {
    if (!this.elements.storeList) return;
    const models = getStoreCardModels(this.profile);
    this.elements.storeList.replaceChildren(...models.map(model => this._createWeaponCard(model, 'store')));
  }
}
