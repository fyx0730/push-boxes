import type { LevelData, TileType, Position } from './types';

// 随机数生成器
class Random {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  nextInt(min: number, max: number) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

const DIRS = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 }
];

export interface GeneratorConfig {
  width: number;
  height: number;
  boxes: number;
  steps?: number;
}

export const generateSokobanLevel = (seed: number, configOrDiff: 'easy' | 'medium' | 'hard' | GeneratorConfig): LevelData => {
  let currentSeed = seed;
  let rng = new Random(currentSeed);
  
  let config: Required<GeneratorConfig>;

  if (typeof configOrDiff === 'string') {
    const presets = {
      easy:   { width: 8,  height: 8,  boxes: 2, steps: 100 },
      medium: { width: 10, height: 10, boxes: 3, steps: 300 },
      hard:   { width: 12, height: 12, boxes: 4, steps: 500 }
    };
    config = presets[configOrDiff];
  } else {
    config = {
      steps: configOrDiff.boxes * 100 + 200, // 增加默认步数
      ...configOrDiff
    } as Required<GeneratorConfig>;
  }

  const { width: w, height: h } = config;

  // 强制循环直到成功
  // 为了防止死循环，设置一个超高上限，如果还不行就降低难度重试
  let totalAttempts = 0;
  
  while (totalAttempts < 500) {
    totalAttempts++;
    // 每次重试都变化种子
    rng = new Random(currentSeed + totalAttempts * 113);

    const map: TileType[][] = Array(h).fill(0).map(() => Array(w).fill(1));

    // 地形生成：稍微增加一点随机性
    for(let y=1; y<h-1; y++) {
      for(let x=1; x<w-1; x++) {
        map[y][x] = 0;
      }
    }
    
    // 障碍物：数量稍微随机一点
    const obstacleBase = config.boxes === 1 ? 0.05 : 0.15;
    const obstacleCount = Math.floor(w * h * obstacleBase) + rng.nextInt(-2, 2);
    
    for(let i=0; i<Math.max(0, obstacleCount); i++) {
      const x = rng.nextInt(1, w-2);
      const y = rng.nextInt(1, h-2);
      map[y][x] = 1;
    }

    const isValid = (x: number, y: number) => x >= 0 && x < w && y >= 0 && y < h;
    const isFloor = (x: number, y: number) => isValid(x, y) && map[y][x] !== 1;

    const getEmptySpot = (): Position => {
      for(let i=0; i<100; i++) {
        const x = rng.nextInt(1, w-2);
        const y = rng.nextInt(1, h-2);
        if (map[y][x] === 0) return { x, y };
      }
      return { x: 1, y: 1 };
    };

    // 初始化
    let player = getEmptySpot();
    let boxes: Position[] = [];
    let targets: Position[] = [];
    
    let setupFailed = false;
    for(let i=0; i<config.boxes; i++) {
      let pos = getEmptySpot();
      let tries = 0;
      while(
        ((pos.x === player.x && pos.y === player.y) ||
        boxes.some(b => b.x === pos.x && b.y === pos.y)) && tries < 50
      ) {
        pos = getEmptySpot();
        tries++;
      }
      if (tries >= 50) { setupFailed = true; break; } // 无法放置，重试整个地图
      
      boxes.push(pos);
      targets.push({ ...pos });
      map[pos.y][pos.x] = 2;
    }
    if (setupFailed) continue;

    // 反向模拟
    // 改进：如果连续多次没拉动箱子，尝试强制瞬移玩家到某个箱子附近（作弊一下，为了让生成继续）
    // 但为了保证可解性，我们只能“瞬移”到连通区域。这里简化处理：增加尝试次数。
    
    let pullCount = 0; // 记录成功拉动的次数

    for(let i=0; i<config.steps; i++) {
      const pullableBoxes = boxes.map((b, idx) => {
        const dx = player.x - b.x;
        const dy = player.y - b.y;
        if (Math.abs(dx) + Math.abs(dy) !== 1) return null;
        
        const backX = player.x + dx;
        const backY = player.y + dy;
        
        if (!isFloor(backX, backY)) return null;
        if (boxes.some(bx => bx.x === backX && bx.y === backY)) return null;
        
        return { idx, backX, backY, prevPlayerX: player.x, prevPlayerY: player.y };
      }).filter(Boolean);

      let didPull = false;
      // 95% 概率优先拉箱子
      if (pullableBoxes.length > 0 && rng.nextInt(0, 100) < 95) {
        const move = pullableBoxes[rng.nextInt(0, pullableBoxes.length - 1)]!;
        player = { x: move.backX, y: move.backY };
        boxes[move.idx] = { x: move.prevPlayerX, y: move.prevPlayerY };
        didPull = true;
        pullCount++;
      }

      if (!didPull) {
        const dir = DIRS[rng.nextInt(0, 3)];
        const nextX = player.x + dir.dx;
        const nextY = player.y + dir.dy;
        if (isFloor(nextX, nextY) && !boxes.some(b => b.x === nextX && b.y === nextY)) {
          player = { x: nextX, y: nextY };
        }
      }
    }

    // 强校验：
    // 1. 所有箱子都不能在目标点上 (BoxesOnTarget == 0)
    // 2. 至少成功拉动了足够多次数 (pullCount > boxes * 2)，避免只是在原地拉了一下
    
    const boxesOnTarget = boxes.filter(b => 
      targets.some(t => t.x === b.x && t.y === b.y)
    ).length;

    // 容忍度控制：如果尝试了很多次还是太难完全移开，稍微放宽一点点？
    // 不，我们坚持 boxesOnTarget === 0，因为这是玩家体验的底线。
    if (boxesOnTarget === 0 && pullCount >= config.boxes * 3) {
      return { map, player, boxes };
    }
  }
  
  // 如果真的 500 次都失败了（极低概率），为了不崩，只能返回一个硬编码的简单关卡
  // 这是一个绝对安全的 Fallback 关卡 (Easy)
  return { 
      map: [
          [1,1,1,1,1,1,1],
          [1,0,0,0,0,0,1],
          [1,0,2,3,0,0,1], // 注意这里 3 不是 TileType，只是示意。修正如下：
          [1,0,0,0,0,0,1],
          [1,1,1,1,1,1,1]
      ].map(row => row.map(c => c === 3 ? 0 : c)) as TileType[][], 
      player: {x:1, y:1}, 
      boxes: [{x:3, y:2}] 
  };
};
