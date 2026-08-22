const WALL_MIN = 1;
const WALL_MAX = 4;

function isWall(tile) {
  return tile >= WALL_MIN && tile <= WALL_MAX;
}

function isPassable(tile) {
  return Number.isInteger(tile) && !isWall(tile) && tile >= 0 && tile <= 8;
}

function findTiles(grid, tile) {
  const locations = [];
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    if (!Array.isArray(row)) continue;
    for (let x = 0; x < row.length; x++) {
      if (row[x] === tile) locations.push({ x, y });
    }
  }
  return locations;
}

function hasPassableNeighbor(grid, location) {
  const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  return directions.some(([dx, dy]) => isPassable(grid[location.y + dy]?.[location.x + dx]));
}

function getReachableTiles(grid, start) {
  const visited = new Set([`${start.x},${start.y}`]);
  const queue = [start];
  const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];

  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    for (const [dx, dy] of directions) {
      const x = current.x + dx;
      const y = current.y + dy;
      const key = `${x},${y}`;
      if (!visited.has(key) && isPassable(grid[y]?.[x])) {
        visited.add(key);
        queue.push({ x, y });
      }
    }
  }

  return visited;
}

export function validateGeneratedMap(grid, definition = {}) {
  const errors = [];
  const rows = Array.isArray(grid) ? grid : [];
  const height = rows.length;
  const width = Array.isArray(rows[0]) ? rows[0].length : 0;
  const rectangular = height > 0 && rows.every(row => Array.isArray(row) && row.length === width);

  if (!rectangular) errors.push('grid must be rectangular');
  if (definition.width !== undefined && width !== definition.width) errors.push('width does not match definition');
  if (definition.height !== undefined && height !== definition.height) errors.push('height does not match definition');

  let passableTiles = 0;
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    for (const tile of row) {
      if (!Number.isInteger(tile) || tile < 0 || tile > 8) errors.push(`illegal tile value: ${tile}`);
      if (isPassable(tile)) passableTiles++;
    }
  }

  if (rectangular) {
    for (let x = 0; x < width; x++) {
      if (!isWall(rows[0][x]) || !isWall(rows[height - 1][x])) {
        errors.push('boundary must be closed by walls');
        break;
      }
    }
    for (let y = 0; y < height; y++) {
      if (!isWall(rows[y][0]) || !isWall(rows[y][width - 1])) {
        errors.push('boundary must be closed by walls');
        break;
      }
    }
  }

  const playerSpawns = findTiles(rows, 7);
  const enemySpawns = findTiles(rows, 8);
  const targetASpawns = findTiles(rows, 5);
  const targetBSpawns = findTiles(rows, 6);

  if (playerSpawns.length < 1) errors.push('requires at least one player spawn');
  if (enemySpawns.length < 3) errors.push('requires at least three enemy spawns');
  if (targetASpawns.length < 1) errors.push('requires target-a tile');
  if (targetBSpawns.length < 1) errors.push('requires target-b tile');

  for (const spawn of [...playerSpawns, ...enemySpawns]) {
    if (!hasPassableNeighbor(rows, spawn)) errors.push(`spawn at ${spawn.x},${spawn.y} has no passable neighbor`);
  }

  let reachableEnemySpawns = 0;
  if (rectangular && playerSpawns.length > 0) {
    const reachable = getReachableTiles(rows, playerSpawns[0]);
    reachableEnemySpawns = enemySpawns.filter(spawn => reachable.has(`${spawn.x},${spawn.y}`)).length;
    if (reachableEnemySpawns !== enemySpawns.length) errors.push('enemy spawn is unreachable from player spawn');
  }

  const totalTiles = width * height;
  const passableRatio = totalTiles === 0 ? 0 : passableTiles / totalTiles;
  if (passableRatio < 0.3 || passableRatio > 0.78) errors.push('passable ratio must be between 30% and 78%');

  return {
    valid: errors.length === 0,
    errors,
    metrics: {
      width,
      height,
      passableTiles,
      passableRatio,
      playerSpawnCount: playerSpawns.length,
      enemySpawnCount: enemySpawns.length,
      reachableEnemySpawns,
    },
  };
}
