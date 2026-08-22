const freezeMap = definition => Object.freeze({
  ...definition,
  tags: Object.freeze([...definition.tags]),
  variant: Object.freeze({ ...definition.variant }),
});

export const MAP_SERIES = Object.freeze([
  Object.freeze({ id: 'ship', name: '运输船' }),
  Object.freeze({ id: 'plaza', name: '广场' }),
  Object.freeze({ id: 'alley', name: '巷子' }),
  Object.freeze({ id: 'street', name: '街道' }),
]);

export const MAP_CATALOG = Object.freeze([
  freezeMap({ id: 'ship-deck', series: 'ship', name: '甲板突袭', callout: 'DECK RAID', description: '双长线与集装箱掩体。', difficulty: 1, width: 24, height: 24, seed: 1001, roundTime: 180, tags: ['long-lanes', 'cover'], variant: { crossCuts: 2, cover: 4 } }),
  freezeMap({ id: 'ship-cargo', series: 'ship', name: '货舱迷宫', callout: 'CARGO HOLD', description: '紧凑货舱与横向切口。', difficulty: 2, width: 26, height: 24, seed: 1002, roundTime: 175, tags: ['cargo', 'cross-cuts'], variant: { crossCuts: 3, cover: 5 } }),
  freezeMap({ id: 'ship-bridge', series: 'ship', name: '舰桥封锁', callout: 'BRIDGE LOCK', description: '中央高压通道与两侧绕行。', difficulty: 3, width: 28, height: 26, seed: 1003, roundTime: 170, tags: ['bridge', 'flank'], variant: { crossCuts: 3, cover: 6 } }),
  freezeMap({ id: 'ship-storm', series: 'ship', name: '风暴船首', callout: 'STORM BOW', description: '收窄前场与开阔后场。', difficulty: 3, width: 30, height: 26, seed: 1004, roundTime: 170, tags: ['bow', 'open-rear'], variant: { crossCuts: 4, cover: 5 } }),
  freezeMap({ id: 'ship-night-port', series: 'ship', name: '夜港航线', callout: 'NIGHT PORT', description: '多段折线路与交叉火力。', difficulty: 4, width: 32, height: 28, seed: 1005, roundTime: 165, tags: ['night', 'crossfire'], variant: { crossCuts: 4, cover: 7 } }),

  freezeMap({ id: 'plaza-fountain', series: 'plaza', name: '喷泉广场', callout: 'FOUNTAIN', description: '中央开放区与外环。', difficulty: 1, width: 24, height: 24, seed: 2001, roundTime: 180, tags: ['central', 'ring'], variant: { cover: 3, ringInset: 3 } }),
  freezeMap({ id: 'plaza-market', series: 'plaza', name: '旧城集市', callout: 'OLD MARKET', description: '摊位掩体与短距离交火。', difficulty: 2, width: 26, height: 26, seed: 2002, roundTime: 175, tags: ['market', 'close-range'], variant: { cover: 5, ringInset: 3 } }),
  freezeMap({ id: 'plaza-memorial', series: 'plaza', name: '纪念碑环线', callout: 'MEMORIAL', description: '环形走位与四向入口。', difficulty: 2, width: 28, height: 26, seed: 2003, roundTime: 175, tags: ['ring', 'four-entries'], variant: { cover: 4, ringInset: 4 } }),
  freezeMap({ id: 'plaza-civic', series: 'plaza', name: '市政前庭', callout: 'CIVIC YARD', description: '宽正面与侧翼走廊。', difficulty: 3, width: 30, height: 28, seed: 2004, roundTime: 170, tags: ['wide-front', 'flank'], variant: { cover: 6, ringInset: 4 } }),
  freezeMap({ id: 'plaza-station', series: 'plaza', name: '车站前场', callout: 'STATION', description: '多入口中央争夺区。', difficulty: 4, width: 32, height: 28, seed: 2005, roundTime: 165, tags: ['station', 'contested'], variant: { cover: 7, ringInset: 4 } }),

  freezeMap({ id: 'alley-brick', series: 'alley', name: '红砖暗巷', callout: 'BRICK ALLEY', description: '单主巷与安全支路。', difficulty: 1, width: 24, height: 26, seed: 3001, roundTime: 180, tags: ['brick', 'main-alley'], variant: { blocks: 3, cuts: 3 } }),
  freezeMap({ id: 'alley-rain', series: 'alley', name: '雨幕后街', callout: 'RAIN BACKSTREET', description: '交错短巷与近身转角。', difficulty: 2, width: 26, height: 26, seed: 3002, roundTime: 175, tags: ['rain', 'close-corners'], variant: { blocks: 4, cuts: 4 } }),
  freezeMap({ id: 'alley-pipes', series: 'alley', name: '管线夹道', callout: 'PIPE RUN', description: '狭窄长线与机械掩体。', difficulty: 3, width: 28, height: 28, seed: 3003, roundTime: 170, tags: ['pipes', 'narrow'], variant: { blocks: 5, cuts: 4 } }),
  freezeMap({ id: 'alley-nine-turns', series: 'alley', name: '九曲巷', callout: 'NINE TURNS', description: '高频转角与多条切口。', difficulty: 4, width: 30, height: 28, seed: 3004, roundTime: 165, tags: ['turns', 'shortcuts'], variant: { blocks: 6, cuts: 5 } }),
  freezeMap({ id: 'alley-night-market', series: 'alley', name: '夜市暗巷', callout: 'NIGHT MARKET', description: '密集掩体与不对称路线。', difficulty: 4, width: 32, height: 30, seed: 3005, roundTime: 165, tags: ['night-market', 'asymmetric'], variant: { blocks: 7, cuts: 5 } }),

  freezeMap({ id: 'street-crossing', series: 'street', name: '十字街口', callout: 'CROSSING', description: '十字主路与四块街区。', difficulty: 1, width: 24, height: 24, seed: 4001, roundTime: 180, tags: ['crossroads', 'blocks'], variant: { roads: 1, barricades: 3 } }),
  freezeMap({ id: 'street-tram', series: 'street', name: '电车大道', callout: 'TRAM AVENUE', description: '双平行主路与中部穿越。', difficulty: 2, width: 26, height: 26, seed: 4002, roundTime: 175, tags: ['tram', 'parallel-roads'], variant: { roads: 2, barricades: 4 } }),
  freezeMap({ id: 'street-blockade', series: 'street', name: '封锁街区', callout: 'BLOCKADE', description: '路障掩体与侧巷绕后。', difficulty: 3, width: 28, height: 28, seed: 4003, roundTime: 170, tags: ['blockade', 'side-alley'], variant: { roads: 2, barricades: 6 } }),
  freezeMap({ id: 'street-riverside', series: 'street', name: '滨河公路', callout: 'RIVERSIDE', description: '长距离视线与内侧街区。', difficulty: 3, width: 30, height: 30, seed: 4004, roundTime: 170, tags: ['riverside', 'long-sightline'], variant: { roads: 1, barricades: 5 } }),
  freezeMap({ id: 'street-industrial', series: 'street', name: '工业长街', callout: 'INDUSTRIAL', description: '长街压制与厂房切口。', difficulty: 4, width: 32, height: 32, seed: 4005, roundTime: 165, tags: ['industrial', 'long-street'], variant: { roads: 2, barricades: 7 } }),
]);

export const DEFAULT_MAP_ID = 'ship-deck';

export function getMapDefinition(id) {
  return MAP_CATALOG.find(map => map.id === id)
    ?? MAP_CATALOG.find(map => map.id === DEFAULT_MAP_ID);
}

export function listMapsBySeries(series) {
  return MAP_CATALOG.filter(map => map.series === series);
}
