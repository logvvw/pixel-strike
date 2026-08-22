import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_MAP_ID,
  MAP_SERIES,
  MAP_CATALOG,
  getMapDefinition,
  listMapsBySeries,
} from '../js/maps/catalog.js';
import { buildMapPreview, generateMap } from '../js/maps/generator.js';
import { validateGeneratedMap } from '../js/maps/validator.js';

test('catalog contains five maps in each of four series', () => {
  assert.equal(MAP_CATALOG.length, 20);
  for (const series of MAP_SERIES) {
    assert.equal(listMapsBySeries(series.id).length, 5);
  }
  assert.equal(new Set(MAP_CATALOG.map(map => map.id)).size, 20);
});

test('catalog retains the approved ordering, immutable definitions, and default lookup', () => {
  assert.deepEqual(MAP_CATALOG.map(map => map.id), [
    'ship-deck', 'ship-cargo', 'ship-bridge', 'ship-storm', 'ship-night-port',
    'plaza-fountain', 'plaza-market', 'plaza-memorial', 'plaza-civic', 'plaza-station',
    'alley-brick', 'alley-rain', 'alley-pipes', 'alley-nine-turns', 'alley-night-market',
    'street-crossing', 'street-tram', 'street-blockade', 'street-riverside', 'street-industrial',
  ]);
  for (const definition of MAP_CATALOG) {
    for (const field of ['id', 'series', 'name', 'callout', 'description', 'difficulty', 'width', 'height', 'seed', 'roundTime', 'tags', 'variant']) {
      assert.ok(Object.hasOwn(definition, field), `${definition.id} is missing ${field}`);
    }
    assert.equal(Object.isFrozen(definition), true, `${definition.id} must be frozen`);
  }
  assert.equal(getMapDefinition('not-a-map'), getMapDefinition(DEFAULT_MAP_ID));
});

test('every catalog map is deterministic and valid', () => {
  for (const definition of MAP_CATALOG) {
    const first = generateMap(definition);
    const second = generateMap(definition);
    assert.deepEqual(first, second, definition.id);

    const result = validateGeneratedMap(first, definition);
    assert.equal(result.valid, true, `${definition.id}: ${result.errors.join(', ')}`);
  }
});

test('street roads and side alleys are distinct and use the roads variant', () => {
  const definition = getMapDefinition('street-tram');
  const oneRoad = generateMap({
    ...definition,
    variant: { ...definition.variant, roads: 1 },
  });
  const twoRoads = generateMap(definition);
  const middleX = Math.floor(definition.width / 2);
  const middleY = Math.floor(definition.height / 2);
  const isPassable = tile => tile === 0 || (tile >= 5 && tile <= 8);

  assert.notDeepEqual(oneRoad, twoRoads);
  for (const y of [middleY, middleY + 1]) {
    assert.ok(twoRoads[y].slice(1, -1).every(isPassable), `row ${y} should be a wide road`);
  }
  for (const x of [middleX, middleX + 1, 3, definition.width - 4]) {
    assert.ok(twoRoads.slice(1, -1).every(row => isPassable(row[x])), `column ${x} should be a road or side alley`);
  }
});

test('preview flattens wall materials and special tile semantics', () => {
  const preview = buildMapPreview([
    [1, 2, 3],
    [4, 5, 6],
    [0, 7, 8],
  ]);

  assert.deepEqual(preview, {
    width: 3,
    height: 3,
    cells: [
      { x: 0, y: 0, tile: 1, kind: 'wall', material: 1 },
      { x: 1, y: 0, tile: 2, kind: 'wall', material: 2 },
      { x: 2, y: 0, tile: 3, kind: 'wall', material: 3 },
      { x: 0, y: 1, tile: 4, kind: 'wall', material: 4 },
      { x: 1, y: 1, tile: 5, kind: 'target-a' },
      { x: 2, y: 1, tile: 6, kind: 'target-b' },
      { x: 0, y: 2, tile: 0, kind: 'floor' },
      { x: 1, y: 2, tile: 7, kind: 'player-spawn' },
      { x: 2, y: 2, tile: 8, kind: 'enemy-spawn' },
    ],
  });
});

const validGrid = [
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 7, 0, 0, 5, 0, 8, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 8, 0, 0, 6, 0, 8, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
];

const testDefinition = { width: 8, height: 5 };

test('validator rejects an open boundary', () => {
  const grid = validGrid.map(row => [...row]);
  grid[0][3] = 0;

  const result = validateGeneratedMap(grid, testDefinition);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes('boundary')));
});

test('validator rejects an enemy spawn disconnected from the player', () => {
  const grid = validGrid.map(row => [...row]);
  grid[1][6] = 0;
  grid[2][5] = 1;
  grid[2][6] = 1;
  grid[2][7] = 1;
  grid[1][5] = 1;
  grid[1][6] = 8;

  const result = validateGeneratedMap(grid, testDefinition);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes('unreachable')));
});

test('validator rejects ragged rows', () => {
  const grid = validGrid.map(row => [...row]);
  grid[2].pop();

  const result = validateGeneratedMap(grid, testDefinition);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes('rectangular')));
});

test('validator returns a structural error for a non-array row', () => {
  const result = validateGeneratedMap([null]);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes('rectangular')));
});

test('validator rejects an illegal tile value', () => {
  const grid = validGrid.map(row => [...row]);
  grid[2][3] = 9;

  const result = validateGeneratedMap(grid, testDefinition);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes('tile')));
});
