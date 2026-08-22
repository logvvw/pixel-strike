import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getEquipmentRows,
  getHealthState,
  getMapIdentityModel,
  getOverlayModel,
} from '../js/ui/hud.js';

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
