import test from 'node:test';
import assert from 'node:assert/strict';

import { createDefaultProfile } from '../js/profile/profile.js';
import { MAP_CATALOG } from '../js/maps/catalog.js';
import { WEAPONS } from '../js/weapons/weapons.js';
import {
  getArmoryCardModels,
  getMapCardModels,
  getNextMapFocusIndex,
  getProfileActionStatus,
  getStoreCardModels,
  normalizeStatusTone,
  OperationsHub,
  renderPreviewToCanvas,
} from '../js/ui/operations-hub.js';

test('profile action status maps every supported action result to the exact hub copy', () => {
  const cases = [
    ['purchase', { ok: true }, '沙漠之鹰', { message: '已解锁 沙漠之鹰', tone: 'success' }],
    ['purchase', { ok: false, reason: 'owned' }, '', { message: '已拥有该武器', tone: 'neutral' }],
    ['purchase', { ok: false, reason: 'insufficient-funds' }, '', { message: '军械点数不足', tone: 'warning' }],
    ['purchase', { ok: false, reason: 'unknown' }, 'missing', { message: '未知武器', tone: 'error' }],
    ['equip', { ok: true, equipped: true }, 'UMP-45', { message: '已装备 UMP-45', tone: 'success' }],
    ['equip', { ok: true, equipped: false }, 'UMP-45', { message: '已卸下 UMP-45', tone: 'neutral' }],
    ['equip', { ok: false, reason: 'not-owned' }, '', { message: '请先购买该武器', tone: 'warning' }],
    ['equip', { ok: false, reason: 'full' }, '', { message: '装备槽已满', tone: 'warning' }],
    ['equip', { ok: false, reason: 'last-equipped' }, '', { message: '至少保留一把出战武器', tone: 'warning' }],
    ['map', { ok: true }, '', { message: '地图已选择', tone: 'success' }],
    ['map', { ok: false, reason: 'unknown' }, '', { message: '未知地图', tone: 'error' }],
    ['purchase', { ok: false, reason: 'unexpected' }, '', { message: '操作未完成', tone: 'error' }],
    ['unexpected', { ok: false, reason: 'unknown' }, '', { message: '操作未完成', tone: 'error' }],
  ];

  for (const [action, result, subjectName, expected] of cases) {
    assert.deepEqual(getProfileActionStatus(action, result, subjectName), expected);
  }
});

test('profile action status warns when any successful in-memory action fails to save', () => {
  for (const [action, result, subjectName] of [
    ['purchase', { ok: true, saved: false }, '沙漠之鹰'],
    ['equip', { ok: true, equipped: true, saved: false }, 'UMP-45'],
    ['map', { ok: true, saved: false }, ''],
  ]) {
    assert.deepEqual(getProfileActionStatus(action, result, subjectName), {
      message: '进度已更新，但本次可能无法保存',
      tone: 'warning',
    });
  }
});

test('map models preserve catalog order, selection, display metadata, and input state', () => {
  const profile = { ...createDefaultProfile(), selectedMapId: 'alley-pipes' };
  const before = structuredClone(profile);

  const models = getMapCardModels(profile);

  assert.equal(models.length, 20);
  assert.deepEqual(models.map(model => model.id), MAP_CATALOG.map(map => map.id));
  assert.deepEqual(models.filter(model => model.selected).map(model => model.id), ['alley-pipes']);
  assert.deepEqual(models[0], {
    id: 'ship-deck',
    series: 'ship',
    name: '甲板突袭',
    callout: 'DECK RAID',
    description: '双长线与集装箱掩体。',
    difficulty: 1,
    difficultyLabel: '难度 1 // 新兵',
    dimensions: '24 × 24',
    tags: ['long-lanes', 'cover'],
    selected: false,
  });
  assert.notEqual(models[0].tags, MAP_CATALOG[0].tags);
  assert.deepEqual(profile, before);
});

test('map filters return one ordered series and unknown filters safely return all maps', () => {
  const profile = createDefaultProfile();

  for (const series of ['ship', 'plaza', 'alley', 'street']) {
    const models = getMapCardModels(profile, series);
    assert.equal(models.length, 5);
    assert.ok(models.every(model => model.series === series));
  }
  assert.deepEqual(
    getMapCardModels(profile, 'not-a-series').map(model => model.id),
    MAP_CATALOG.map(map => map.id),
  );
});

test('store models expose all weapons in catalog order with exclusive purchase states', () => {
  const profile = {
    ...createDefaultProfile(),
    credits: 1000,
    ownedWeaponIds: ['pistol', 'usp'],
    equippedWeaponIds: ['pistol'],
  };
  const before = structuredClone(profile);

  const models = getStoreCardModels(profile);

  assert.equal(models.length, 12);
  assert.deepEqual(models.map(model => model.id), Object.keys(WEAPONS));
  assert.deepEqual(
    models.map(({ id, owned, affordable, locked }) => ({ id, owned, affordable, locked })),
    [
      { id: 'pistol', owned: true, affordable: false, locked: false },
      { id: 'usp', owned: true, affordable: false, locked: false },
      { id: 'deagle', owned: false, affordable: true, locked: false },
      { id: 'uzi', owned: false, affordable: false, locked: true },
      { id: 'ump45', owned: false, affordable: false, locked: true },
      { id: 'nova', owned: false, affordable: false, locked: true },
      { id: 'xm1014', owned: false, affordable: false, locked: true },
      { id: 'famas', owned: false, affordable: false, locked: true },
      { id: 'm4a1', owned: false, affordable: false, locked: true },
      { id: 'ak47', owned: false, affordable: false, locked: true },
      { id: 'scout', owned: false, affordable: false, locked: true },
      { id: 'awp', owned: false, affordable: false, locked: true },
    ],
  );
  assert.deepEqual(
    Object.keys(models[0]),
    ['id', 'name', 'category', 'unlockPrice', 'display', 'description', 'owned', 'affordable', 'locked'],
  );
  assert.notEqual(models[0].display, WEAPONS.pistol.display);
  assert.deepEqual(profile, before);
});

test('normalized default profile owns Glock and can afford the next catalog weapon', () => {
  const models = getStoreCardModels(createDefaultProfile());

  assert.equal(models[0].name, 'Glock-18');
  assert.equal(models[0].owned, true);
  assert.equal(models[1].affordable, true);
});

test('armory models keep owned catalog order while slot and capacity rules follow loadout order', () => {
  const profile = {
    ...createDefaultProfile(),
    ownedWeaponIds: ['ak47', 'pistol', 'uzi', 'usp', 'deagle'],
    equippedWeaponIds: ['ak47', 'pistol', 'uzi', 'usp'],
  };
  const before = structuredClone(profile);

  const models = getArmoryCardModels(profile);

  assert.deepEqual(models.map(model => model.id), ['pistol', 'usp', 'deagle', 'uzi', 'ak47']);
  assert.deepEqual(
    models.map(({ id, equipped, slot, canEquip, canRemove }) => (
      { id, equipped, slot, canEquip, canRemove }
    )),
    [
      { id: 'pistol', equipped: true, slot: 2, canEquip: false, canRemove: true },
      { id: 'usp', equipped: true, slot: 4, canEquip: false, canRemove: true },
      { id: 'deagle', equipped: false, slot: null, canEquip: false, canRemove: false },
      { id: 'uzi', equipped: true, slot: 3, canEquip: false, canRemove: true },
      { id: 'ak47', equipped: true, slot: 1, canEquip: false, canRemove: true },
    ],
  );
  assert.deepEqual(profile, before);
});

test('armory allows additions below four slots and protects the final equipped weapon', () => {
  const models = getArmoryCardModels({
    ...createDefaultProfile(),
    ownedWeaponIds: ['pistol', 'usp'],
    equippedWeaponIds: ['pistol'],
  });

  assert.deepEqual(
    models.map(({ id, canEquip, canRemove }) => ({ id, canEquip, canRemove })),
    [
      { id: 'pistol', canEquip: false, canRemove: false },
      { id: 'usp', canEquip: true, canRemove: false },
    ],
  );
});

test('preview paints every actual grid tile with deterministic tactical colors', () => {
  const calls = [];
  const context = {
    imageSmoothingEnabled: true,
    fillStyle: '',
    clearRect: (...args) => calls.push(['clearRect', ...args]),
    fillRect: (...args) => calls.push(['fillRect', context.fillStyle, ...args]),
  };
  const canvas = {
    width: 80,
    height: 40,
    getContext: kind => kind === '2d' ? context : null,
  };

  renderPreviewToCanvas(canvas, [
    [0, 1, 5, 6],
    [7, 8, 2, 4],
  ]);

  assert.equal(context.imageSmoothingEnabled, false);
  assert.deepEqual(calls, [
    ['clearRect', 0, 0, 80, 40],
    ['fillRect', '#232721', 0, 0, 20, 20],
    ['fillRect', '#777468', 20, 0, 20, 20],
    ['fillRect', '#e3b341', 40, 0, 20, 20],
    ['fillRect', '#c2b28c', 60, 0, 20, 20],
    ['fillRect', '#87a36f', 0, 20, 20, 20],
    ['fillRect', '#c65343', 20, 20, 20, 20],
    ['fillRect', '#59604a', 40, 20, 20, 20],
    ['fillRect', '#a69a7b', 60, 20, 20, 20],
  ]);
});

test('preview safely ignores unavailable canvas state and empty grids', () => {
  assert.doesNotThrow(() => renderPreviewToCanvas(null, [[0]]));
  assert.doesNotThrow(() => renderPreviewToCanvas({ getContext: () => null }, [[0]]));
  assert.doesNotThrow(() => renderPreviewToCanvas({
    width: 20,
    height: 20,
    getContext: () => ({ clearRect() { throw new Error('empty grid must not paint'); } }),
  }, []));
});

test('status tones retain approved values and normalize unknown input to neutral', () => {
  assert.deepEqual(
    ['neutral', 'success', 'warning', 'error', 'urgent', null]
      .map(normalizeStatusTone),
    ['neutral', 'success', 'warning', 'error', 'neutral', 'neutral'],
  );
});

test('map focus index wraps for horizontal and vertical arrow movement', () => {
  assert.equal(getNextMapFocusIndex(0, 'ArrowLeft', 5), 4);
  assert.equal(getNextMapFocusIndex(4, 'ArrowRight', 5), 0);
  assert.equal(getNextMapFocusIndex(1, 'ArrowUp', 5), 0);
  assert.equal(getNextMapFocusIndex(3, 'ArrowDown', 5), 4);
  assert.equal(getNextMapFocusIndex(2, 'Enter', 5), 2);
  assert.equal(getNextMapFocusIndex(-1, 'ArrowRight', 0), -1);
});

// OperationsHub needs a DOM. Stub one that returns null for the root
// element so the constructor's _installListeners() short-circuits cleanly —
// the tests below only exercise the sound-option wiring, not DOM events.
function withNullDocument(callback) {
  const previous = globalThis.document;
  globalThis.document = { getElementById: () => null };
  try {
    return callback();
  } finally {
    globalThis.document = previous;
  }
}

test('OperationsHub accepts a sound option and exposes it on the instance', () => {
  const sound = { select() {}, fire() {} };
  const hub = withNullDocument(() => new OperationsHub({ sound }));
  assert.equal(hub.sound, sound);
});

test('OperationsHub defaults sound to null when none is provided', () => {
  const hub = withNullDocument(() => new OperationsHub());
  assert.equal(hub.sound, null);
});

test('OperationsHub rejects a sound object that lacks a select method', () => {
  const hub = withNullDocument(() => new OperationsHub({ sound: { fire() {} } }));
  assert.equal(hub.sound, null);
});
