import test from 'node:test';
import assert from 'node:assert/strict';

import {
  drawMinimap,
  getEquipmentRows,
  getHealthState,
  getMapIdentityModel,
  getOverlayModel,
} from '../js/ui/hud.js';

function createMockContext() {
  const log = [];
  const handler = {
    get(_, prop) {
      if (prop === 'canvas') return {};
      return (...args) => log.push([prop, ...args]);
    },
    set(_, prop, value) {
      log.push([prop, value]);
      return true;
    },
  };
  return { ctx: new Proxy({}, handler), log };
}

test('health state maps combat damage to stable tactical states', () => {
  assert.equal(getHealthState(100), 'nominal');
  assert.equal(getHealthState(60), 'warning');
  assert.equal(getHealthState(20), 'critical');
});

test('equipment rows follow equipped instance order with slots and selected state', () => {
  const rows = getEquipmentRows({
    currentWeaponIdx: 1,
    weapons: [
      { id: 'sidearm-02', name: 'USP', category: 'SIDEARM' },
      { id: 'rifle-07', name: 'AK-47', category: 'RIFLE' },
      { id: 'sidearm-02', name: 'USP', category: 'SIDEARM' },
    ],
  });

  assert.deepEqual(rows, [
    { id: 'sidearm-02', name: 'USP', category: 'SIDEARM', slot: 1, selected: false },
    { id: 'rifle-07', name: 'AK-47', category: 'RIFLE', slot: 2, selected: true },
    { id: 'sidearm-02', name: 'USP', category: 'SIDEARM', slot: 3, selected: false },
  ]);
  for (const row of rows) {
    assert.equal(Object.hasOwn(row, 'price'), false);
    assert.equal(Object.hasOwn(row, 'affordable'), false);
    assert.equal(Object.hasOwn(row, 'locked'), false);
    assert.equal(Object.hasOwn(row, 'owned'), false);
  }
});

test('map identity model formats known map metadata and safe fallback', () => {
  assert.deepEqual(
    getMapIdentityModel({ name: '甲板突袭', callout: 'DECK RAID' }),
    { name: '甲板突袭', callout: 'DECK RAID', label: '甲板突袭 // DECK RAID' },
  );
  assert.deepEqual(
    getMapIdentityModel(),
    { name: '未知区域', callout: 'UNLISTED', label: '未知区域 // UNLISTED' },
  );
});

test('overlay model preserves plain mission text', () => {
  assert.deepEqual(
    getOverlayModel('任务失败', '得分 100', '重新部署'),
    { title: '任务失败', subtitle: '得分 100', buttonText: '重新部署' },
  );
});

test('overlay model adds secondary action only when supplied', () => {
  const onSecondary = () => {};

  assert.deepEqual(
    getOverlayModel('任务完成', '得分 500', '继续', { label: '返回基地', onClick: onSecondary }),
    {
      title: '任务完成',
      subtitle: '得分 500',
      buttonText: '继续',
      secondary: { label: '返回基地', onClick: onSecondary },
    },
  );
});

test('drawMinimap paints walls, player orientation, and live enemies', () => {
  const { ctx, log } = createMockContext();
  const map = [
    [1, 0, 1],
    [0, 0, 0],
    [1, 1, 0],
  ];
  const player = { x: 1.5, y: 0.5, angle: 0 };
  const entities = [
    { x: 2.5, y: 2.5, alive: true },
    { x: 0.5, y: 1.5, alive: false },
  ];

  drawMinimap(ctx, { width: 90, height: 90, player, map, entities });

  // Player triangle uses moveTo + lineTo + fill. Walls and enemies use fillRect.
  assert.ok(log.some(([method]) => method === 'moveTo'), 'player triangle must trace a path');
  assert.ok(log.some(([method]) => method === 'lineTo'), 'player triangle must trace lines');
  assert.ok(log.some(([method]) => method === 'fill'), 'player triangle must be filled');
  const fillRects = log.filter(([method]) => method === 'fillRect');
  // 4 walls + 1 live enemy (the dead one is skipped) + background = at least 6.
  assert.ok(fillRects.length >= 6, `expected at least 6 fillRect calls, got ${fillRects.length}`);
  // fillStyle must change between background, walls, and enemies.
  const fillStyles = log.filter(([op]) => op === 'fillStyle').map(([, value]) => value);
  assert.ok(new Set(fillStyles).size >= 3, 'minimap must use at least 3 distinct colors');
});

test('drawMinimap without enemies still renders walls and player', () => {
  const { ctx, log } = createMockContext();
  // 全部墙，玩家站在右上角。验证无敌人分支仍绘制背景 + 所有墙 + 玩家三角。
  const map = [[1, 1], [1, 1]];
  const player = { x: 1.5, y: 0.5, angle: 0 };

  drawMinimap(ctx, { width: 60, height: 60, player, map });

  // 4 wall cells + background.
  const fillRects = log.filter(([method]) => method === 'fillRect');
  assert.ok(fillRects.length >= 5, 'walls and background must paint even without enemies');
  assert.ok(log.some(([method]) => method === 'moveTo'));
});
