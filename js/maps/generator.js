function createSeededRandom(seed) {
  let state = (Number(seed) >>> 0) || 0x6d2b79f5;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

function createGrid(width, height) {
  return Array.from({ length: height }, (_, y) => (
    Array.from({ length: width }, (_, x) => (
      x === 0 || y === 0 || x === width - 1 || y === height - 1 ? 1 : 0
    ))
  ));
}

function setWall(grid, x, y, material) {
  if (y > 0 && y < grid.length - 1 && x > 0 && x < grid[0].length - 1) {
    grid[y][x] = material;
  }
}

function addVerticalDivider(grid, x, gaps, material) {
  for (let y = 1; y < grid.length - 1; y++) {
    if (!gaps.includes(y)) setWall(grid, x, y, material);
  }
}

function addHorizontalDivider(grid, y, gaps, material) {
  for (let x = 1; x < grid[0].length - 1; x++) {
    if (!gaps.includes(x)) setWall(grid, x, y, material);
  }
}

function addShipLayout(grid, definition, random) {
  const { width, height } = definition;
  const cutRows = [Math.floor(height / 3), Math.floor((height * 2) / 3)];
  const laneWalls = [Math.floor(width / 4), Math.floor(width / 2), Math.floor((width * 3) / 4)];

  for (const x of laneWalls) {
    addVerticalDivider(grid, x, cutRows, 1 + Math.floor(random() * 4));
  }

  const crossCuts = definition.variant.crossCuts;
  for (let index = 0; index < crossCuts; index++) {
    const x = 2 + ((index * 5 + Math.floor(random() * 3)) % (width - 5));
    const y = 2 + ((index * 7 + Math.floor(random() * 3)) % (height - 5));
    setWall(grid, x, y, 1 + Math.floor(random() * 4));
    setWall(grid, x + 1, y, 1 + Math.floor(random() * 4));
  }
}

function addPlazaLayout(grid, definition, random) {
  const { width, height } = definition;
  const inset = definition.variant.ringInset;
  const left = inset;
  const right = width - 1 - inset;
  const top = inset;
  const bottom = height - 1 - inset;
  const midX = Math.floor(width / 2);
  const midY = Math.floor(height / 2);
  const material = 1 + Math.floor(random() * 4);

  addHorizontalDivider(grid, top, [2, midX, width - 3], material);
  addHorizontalDivider(grid, bottom, [2, midX, width - 3], material);
  addVerticalDivider(grid, left, [2, midY, height - 3], material);
  addVerticalDivider(grid, right, [2, midY, height - 3], material);

  for (let index = 0; index < definition.variant.cover; index++) {
    const x = 2 + ((index * 5 + Math.floor(random() * 4)) % (width - 4));
    const y = 2 + ((index * 3 + Math.floor(random() * 4)) % (height - 4));
    if (x !== midX && y !== midY) setWall(grid, x, y, 1 + Math.floor(random() * 4));
  }
}

function addAlleyLayout(grid, definition, random) {
  const { width, height } = definition;
  const blockCount = definition.variant.blocks + 1;

  for (let index = 0; index < blockCount; index++) {
    const x = 3 + ((index * 5 + Math.floor(random() * 3)) % (width - 7));
    const y = 2 + ((index * 7 + Math.floor(random() * 3)) % (height - 8));
    const blockWidth = 2 + (index % 2);
    const blockHeight = 4 + (index % 3);
    const material = 1 + Math.floor(random() * 4);

    for (let blockY = y; blockY < y + blockHeight; blockY++) {
      for (let blockX = x; blockX < x + blockWidth; blockX++) {
        setWall(grid, blockX, blockY, material);
      }
    }
  }

  for (let index = 0; index < definition.variant.cuts; index++) {
    const x = 2 + ((index * 6 + Math.floor(random() * 4)) % (width - 4));
    const y = 2 + ((index * 4 + Math.floor(random() * 4)) % (height - 4));
    setWall(grid, x, y, 1 + Math.floor(random() * 4));
  }
}

function addStreetLayout(grid, definition, random) {
  const { width, height } = definition;
  const roadX = Math.floor(width / 2);
  const roadY = Math.floor(height / 2);
  const blockWidth = Math.max(3, Math.floor(width / 7));
  const blockHeight = Math.max(3, Math.floor(height / 7));
  const starts = [
    [3, 3],
    [width - blockWidth - 3, 3],
    [3, height - blockHeight - 3],
    [width - blockWidth - 3, height - blockHeight - 3],
  ];

  for (const [startX, startY] of starts) {
    const material = 1 + Math.floor(random() * 4);
    for (let y = startY; y < startY + blockHeight; y++) {
      for (let x = startX; x < startX + blockWidth; x++) {
        setWall(grid, x, y, material);
      }
    }
  }

  for (let index = 0; index < definition.variant.barricades; index++) {
    const horizontal = index % 2 === 0;
    const x = horizontal ? 2 + ((index * 5) % (width - 4)) : roadX + (index % 3) - 1;
    const y = horizontal ? roadY + (index % 3) - 1 : 2 + ((index * 5) % (height - 4));
    setWall(grid, x, y, 1 + Math.floor(random() * 4));
    if (horizontal) setWall(grid, x + 1, y, 1 + Math.floor(random() * 4));
    else setWall(grid, x, y + 1, 1 + Math.floor(random() * 4));
  }

  const reservedFloors = new Set();
  const reserveFloor = (x, y) => {
    grid[y][x] = 0;
    reservedFloors.add(`${x},${y}`);
  };
  const carveHorizontalRoad = y => {
    for (let x = 1; x < width - 1; x++) reserveFloor(x, y);
  };
  const carveVerticalRoute = x => {
    for (let y = 1; y < height - 1; y++) reserveFloor(x, y);
  };

  carveHorizontalRoad(roadY);
  carveHorizontalRoad(roadY + 1);
  carveVerticalRoute(3);
  carveVerticalRoute(width - 4);
  if (definition.variant.roads === 2) {
    carveVerticalRoute(roadX);
    carveVerticalRoute(roadX + 1);
  }

  return reservedFloors;
}

function addCoverToPassableBudget(grid, random, reservedFloors = new Set()) {
  const height = grid.length;
  const width = grid[0].length;
  const requiredWalls = Math.ceil(width * height * 0.25);
  let wallCount = grid.flat().filter(isWall => isWall >= 1 && isWall <= 4).length;
  const candidates = [];

  for (let y = 3; y < height - 3; y++) {
    for (let x = 3; x < width - 3; x++) candidates.push({ x, y });
  }

  for (let index = candidates.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
  }

  for (const { x, y } of candidates) {
    if (wallCount >= requiredWalls || grid[y][x] !== 0 || reservedFloors.has(`${x},${y}`)) continue;
    const neighbors = [grid[y - 1][x], grid[y][x + 1], grid[y + 1][x], grid[y][x - 1]];
    if (neighbors.some(tile => tile >= 1 && tile <= 4)) continue;
    setWall(grid, x, y, 1 + Math.floor(random() * 4));
    wallCount++;
  }
}

function stampRequiredTiles(grid) {
  const height = grid.length;
  const width = grid[0].length;
  const locations = {
    player: [1, 1],
    enemies: [[width - 2, 1], [1, height - 2], [width - 2, height - 2]],
    targetA: [Math.floor(width / 2) - 1, Math.floor(height / 2)],
    targetB: [Math.floor(width / 2) + 1, Math.floor(height / 2)],
  };

  grid[locations.player[1]][locations.player[0]] = 7;
  for (const [x, y] of locations.enemies) grid[y][x] = 8;
  grid[locations.targetA[1]][locations.targetA[0]] = 5;
  grid[locations.targetB[1]][locations.targetB[0]] = 6;
}

export function generateMap(definition) {
  const { width, height, series } = definition;
  const random = createSeededRandom(definition.seed);
  const grid = createGrid(width, height);
  let reservedFloors;

  if (series === 'ship') addShipLayout(grid, definition, random);
  else if (series === 'plaza') addPlazaLayout(grid, definition, random);
  else if (series === 'alley') addAlleyLayout(grid, definition, random);
  else if (series === 'street') reservedFloors = addStreetLayout(grid, definition, random);
  else throw new Error(`Unknown map series: ${series}`);

  addCoverToPassableBudget(grid, random, reservedFloors);
  stampRequiredTiles(grid);
  return grid;
}

const PREVIEW_KINDS = Object.freeze({
  0: 'floor',
  5: 'target-a',
  6: 'target-b',
  7: 'player-spawn',
  8: 'enemy-spawn',
});

export function buildMapPreview(grid) {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const cells = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const tile = grid[y][x];
      if (tile >= 1 && tile <= 4) {
        cells.push({ x, y, tile, kind: 'wall', material: tile });
      } else {
        cells.push({ x, y, tile, kind: PREVIEW_KINDS[tile] ?? 'unknown' });
      }
    }
  }

  return { width, height, cells };
}
