import type { LevelData } from './types';
import { generateSokobanLevel } from './generator';

// --- 经典手写关卡 (前几关) ---
const CLASSIC_LEVELS: LevelData[] = [
  {
    map: [
      [1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 2, 0, 1],
      [1, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1],
    ],
    player: { x: 2, y: 2 },
    boxes: [{ x: 3, y: 2 }],
  },
  {
    map: [
      [1, 1, 1, 1, 1, 0, 0, 0],
      [1, 0, 0, 0, 1, 0, 0, 0],
      [1, 2, 0, 0, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 0, 1],
      [1, 2, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
    ],
    player: { x: 2, y: 2 },
    boxes: [{ x: 3, y: 2 }, { x: 3, y: 3 }],
  },
  {
    map: [
      [0, 1, 1, 1, 1, 1, 0, 0],
      [1, 1, 0, 0, 1, 0, 0, 0],
      [1, 0, 0, 0, 0, 0, 1, 0],
      [1, 0, 0, 0, 0, 2, 1, 0],
      [1, 1, 0, 2, 0, 1, 1, 0],
      [0, 1, 1, 1, 1, 1, 0, 0],
    ],
    player: { x: 2, y: 2 },
    boxes: [
      { x: 3, y: 2 },
      { x: 4, y: 3 },
    ],
  }
];

export const LEVELS: LevelData[] = [];

// 1. 填充经典关卡 (Level 1-3)
LEVELS.push(...CLASSIC_LEVELS);

// 2. 补全剩余关卡 (Level 4-60)
const TOTAL_LEVELS = 60;

for (let i = LEVELS.length; i < TOTAL_LEVELS; i++) {
  const levelNum = i + 1;
  const seed = i * 777 + 123;

  // 定义配置
  let config;

  if (levelNum <= 5) {
    // 4-5: 入门
    config = { width: 7, height: 7, boxes: 1 };
  } else if (levelNum <= 10) {
    // 6-10: 简单
    config = { width: 8, height: 8, boxes: 2 };
  } else if (levelNum <= 20) {
    // 11-20: 过渡 (增加步数以确保充分打乱)
    config = { width: 8, height: 8, boxes: 3, steps: 300 };
  } else if (levelNum <= 30) {
    // 21-30: 9x9, 3 boxes
    config = { width: 9, height: 9, boxes: 3 };
  } else if (levelNum <= 40) {
    // 31-40: 10x10, 4 boxes (普通)
    config = { width: 10, height: 10, boxes: 4 };
  } else if (levelNum <= 50) {
    // 41-50: 10x10, 4 boxes (困难: 更多步数打乱)
    config = { width: 10, height: 10, boxes: 4, steps: 300 };
  } else {
    // 51-60: 10x10, 5 boxes (极难)
    config = { width: 10, height: 10, boxes: 5, steps: 400 };
  }

  LEVELS.push(generateSokobanLevel(seed, config));
}
