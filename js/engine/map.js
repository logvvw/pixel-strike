/**
 * map.js — 地图解析与碰撞检测
 * 格式: 文本文件，每行一组空格分隔的数字
 *   0=空地 1=灰石墙 2=棕木墙 3=红砖墙 4=绿金属墙
 *   5=C点A 6=C点B 7=CT出生 8=T出生
 */

export function parseMap(text) {
  const grid = [];
  const lines = text.trim().split('\n');

  for (const line of lines) {
    const stripped = line.replace(/#.*/, '').trim();
    if (!stripped) continue;
    const row = stripped.split(/\s+/).map(Number);
    if (row.length > 0) grid.push(row);
  }

  return grid;
}

/** 判断某格子是否是墙 */
export function isWall(grid, x, y) {
  const col = Math.floor(x);
  const row = Math.floor(y);
  if (row < 0 || row >= grid.length) return true;
  if (col < 0 || col >= grid[0].length) return true;
  const v = grid[row][col];
  return v >= 1 && v <= 4; // 1-4 是墙
}

/** 获取格子类型值 */
export function getTile(grid, x, y) {
  const col = Math.floor(x);
  const row = Math.floor(y);
  if (row < 0 || row >= grid.length) return 1;
  if (col < 0 || col >= grid[0].length) return 1;
  return grid[row][col];
}

/** 从地图数据中提取关键信息 */
export function extractMetadata(grid) {
  const ctSpawns = [];
  const tSpawns = [];
  let bombSiteA = null;
  let bombSiteB = null;

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const v = grid[r][c];
      if (v === 7) ctSpawns.push({ x: c + 0.5, y: r + 0.5 });
      else if (v === 8) tSpawns.push({ x: c + 0.5, y: r + 0.5 });
      else if (v === 5 && !bombSiteA) bombSiteA = { cx: c + 0.5, cy: r + 0.5 };
      else if (v === 6 && !bombSiteB) bombSiteB = { cx: c + 0.5, cy: r + 0.5 };
    }
  }

  return {
    width: grid[0]?.length ?? 0,
    height: grid.length,
    ctSpawns,
    tSpawns,
    bombSites: { A: bombSiteA, B: bombSiteB }
  };
}

/** 射线-地图相交检测 (用于AI视野和投掷物) */
export function hasLineOfSight(grid, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.001) return true;

  const steps = Math.ceil(dist * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + dx * t;
    const y = y0 + dy * t;
    if (isWall(grid, x, y)) return false;
  }
  return true;
}
