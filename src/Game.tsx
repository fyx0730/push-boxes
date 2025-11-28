import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Position } from './types';
import { LEVELS } from './levels';
import { ARControls } from './ARControls';

// 移除固定常量，改为动态计算
// const CELL_SIZE = 64;  
const ANIMATION_DURATION = '200ms';

// 音效管理 Hook (保持不变)
const useAudio = () => {
  const [isMuted, setIsMuted] = useState(false);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const moveSoundRef = useRef<HTMLAudioElement | null>(null);
  const winSoundRef = useRef<HTMLAudioElement | null>(null);
  const pushSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    bgmRef.current = new Audio('/sounds/bgm.mp3');
    bgmRef.current.loop = true;
    bgmRef.current.volume = 0.3;

    moveSoundRef.current = new Audio('/sounds/move.mp3');
    winSoundRef.current = new Audio('/sounds/win.mp3');
    pushSoundRef.current = new Audio('/sounds/push.mp3');

    const playBgm = () => {
      if (!isMuted) bgmRef.current?.play().catch(() => {});
    };
    document.addEventListener('click', playBgm, { once: true });
    document.addEventListener('keydown', playBgm, { once: true });

    return () => {
      bgmRef.current?.pause();
      document.removeEventListener('click', playBgm);
      document.removeEventListener('keydown', playBgm);
    };
  }, []);

  useEffect(() => {
    if (bgmRef.current) {
      if (isMuted) {
        bgmRef.current.pause();
      } else {
        bgmRef.current.play().catch(() => {});
      }
    }
  }, [isMuted]);

  const playMove = () => {
    if (!isMuted && moveSoundRef.current) {
      moveSoundRef.current.currentTime = 0;
      moveSoundRef.current.play().catch(() => {});
    }
  };

  const playPush = () => {
    if (!isMuted && pushSoundRef.current) {
      pushSoundRef.current.currentTime = 0;
      pushSoundRef.current.play().catch(() => {});
    }
  };

  const playWin = () => {
    if (!isMuted && winSoundRef.current) {
      winSoundRef.current.currentTime = 0;
      winSoundRef.current.play().catch(() => {});
    }
  };

  return { isMuted, setIsMuted, playMove, playPush, playWin };
};

export const Game: React.FC = () => {
  const [levelIndex, setLevelIndex] = useState(0);
  const [level, setLevel] = useState(LEVELS[0]);
  
  // 游戏状态
  const [player, setPlayer] = useState<Position>(LEVELS[0].player);
  const [direction, setDirection] = useState<'up' | 'down' | 'left' | 'right'>('down');
  const [boxes, setBoxes] = useState<Position[]>(LEVELS[0].boxes);
  const [moves, setMoves] = useState(0);
  const [history, setHistory] = useState<{ player: Position; boxes: Position[]; direction: string }[]>([]);
  
  // 动态计算格子大小
  const [cellSize, setCellSize] = useState(48);
  // const containerRef = useRef<HTMLDivElement>(null);
  const [arEnabled, setAREnabled] = useState(true);

  const isWonCheck = useCallback((currentBoxes: Position[]) => {
    const targets: Position[] = [];
    level.map.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell === 2) targets.push({ x, y });
      });
    });
    return targets.every(target => 
      currentBoxes.some(box => box.x === target.x && box.y === target.y)
    );
  }, [level]);

  const isWon = isWonCheck(boxes);
  const { isMuted, setIsMuted, playMove, playPush, playWin } = useAudio();

  useEffect(() => {
    if (isWon) {
      playWin();
      const timer = setTimeout(() => {
        nextLevel();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isWon]);

  // 核心逻辑：根据窗口大小和地图尺寸，动态计算 cellSize
  useEffect(() => {
    const handleResize = () => {
      // 获取视口尺寸
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      
      // 地图维度
      const cols = level.map[0].length;
      const rows = level.map.length;

      // 预留空间：
      // 宽度：左右各 20px padding = 40px
      // 高度：顶部标题(100px) + 底部按钮(80px) + 底部提示(40px) + padding = 约 250px
      const maxWidth = vw - 40;
      const maxHeight = vh - 250; 

      const sizeW = Math.floor(maxWidth / cols);
      const sizeH = Math.floor(maxHeight / rows);

      // 取较小值，并设置上限（防止在大屏上格子太大）和下限
      let newSize = Math.min(sizeW, sizeH);
      newSize = Math.min(newSize, 64); // 最大 64px
      newSize = Math.max(newSize, 20); // 最小 20px

      setCellSize(newSize);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [level]);

  // 初始化关卡
  useEffect(() => {
    const currentLevel = LEVELS[levelIndex];
    setLevel(currentLevel);
    setPlayer(currentLevel.player);
    setBoxes(currentLevel.boxes);
    setMoves(0);
    setHistory([]);
    setDirection('down');
  }, [levelIndex]);

  const move = useCallback((dx: number, dy: number) => {
    if (isWon) return;

    let newDir: 'up' | 'down' | 'left' | 'right' = 'down';
    if (dx === 1) newDir = 'right';
    if (dx === -1) newDir = 'left';
    if (dy === 1) newDir = 'down';
    if (dy === -1) newDir = 'up';
    setDirection(newDir);

    const nextX = player.x + dx;
    const nextY = player.y + dy;

    if (level.map[nextY][nextX] === 1) return;

    const boxIndex = boxes.findIndex(b => b.x === nextX && b.y === nextY);
    let newBoxes = [...boxes];
    let isPushing = false;

    if (boxIndex !== -1) {
      const nextBoxX = nextX + dx;
      const nextBoxY = nextY + dy;
      if (level.map[nextBoxY][nextBoxX] === 1) return;
      if (boxes.some(b => b.x === nextBoxX && b.y === nextBoxY)) return;
      newBoxes[boxIndex] = { x: nextBoxX, y: nextBoxY };
      isPushing = true;
    }

    if (isPushing) playPush();
    else playMove();

    setHistory(prev => [...prev, { player, boxes, direction }]);
    setPlayer({ x: nextX, y: nextY });
    setBoxes(newBoxes);
    setMoves(m => m + 1);

  }, [boxes, player, level, isWon, playMove, playPush, direction]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
      switch (e.key) {
        case 'ArrowUp': case 'w': move(0, -1); break;
        case 'ArrowDown': case 's': move(0, 1); break;
        case 'ArrowLeft': case 'a': move(-1, 0); break;
        case 'ArrowRight': case 'd': move(1, 0); break;
        case 'z': if (e.metaKey || e.ctrlKey) handleUndo(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move]);

  const handleUndo = () => {
    if (history.length === 0) return;
    const lastState = history[history.length - 1];
    setPlayer(lastState.player);
    setBoxes(lastState.boxes);
    setDirection(lastState.direction as any);
    setHistory(prev => prev.slice(0, -1));
    setMoves(m => Math.max(0, m - 1));
  };

  const handleReset = () => {
    setPlayer(level.player);
    setBoxes(level.boxes);
    setMoves(0);
    setHistory([]);
    setDirection('down');
  };

  const nextLevel = () => {
    if (levelIndex < LEVELS.length - 1) setLevelIndex(l => l + 1);
  };

  const prevLevel = () => {
    if (levelIndex > 0) setLevelIndex(l => l - 1);
  };

  const getDifficultyText = (idx: number) => {
    const n = idx + 1;
    if (n <= 5) return { text: '入门', color: 'text-green-400' }; // Level 1-5
    if (n <= 10) return { text: '简单', color: 'text-blue-400' }; // Level 6-10
    if (n <= 20) return { text: '进阶', color: 'text-cyan-400' }; // Level 11-20
    if (n <= 30) return { text: '普通', color: 'text-yellow-400' }; // Level 21-30
    if (n <= 40) return { text: '困难', color: 'text-orange-400' }; // Level 31-40
    if (n <= 50) return { text: '专家', color: 'text-red-400' }; // Level 41-50
    return { text: '大师', color: 'text-purple-500' }; // Level 51-60
  };
  
  const diffInfo = getDifficultyText(levelIndex);

  // 计算容器实际宽高
  const mapWidth = level.map[0].length * cellSize;
  const mapHeight = level.map.length * cellSize;

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-900 text-white font-sans overflow-hidden py-4">
      {/* 顶部栏：控制按钮 */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button 
          onClick={() => setIsMuted(!isMuted)}
          className="p-3 bg-gray-800 rounded-full hover:bg-gray-700 transition-colors shadow-lg text-xl"
          title={isMuted ? '开启音效' : '关闭音效'}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
      </div>

      {/* 标题区域 */}
      <div className="mb-2 text-center z-10 flex-shrink-0">
        <h1 className="text-3xl font-bold mb-1 text-yellow-400 tracking-wider">推箱子</h1>
        <div className="flex gap-4 justify-center items-center text-gray-300 font-medium flex-wrap text-sm">
          <span className="bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
            第 {levelIndex + 1} / {LEVELS.length} 关
          </span>
          <span className={`bg-gray-800 px-3 py-1 rounded-full border border-gray-700 ${diffInfo.color}`}>
            {diffInfo.text}
          </span>
          <span className="bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
            步数: {moves}
          </span>
        </div>
      </div>

      {/* 游戏区域：现在它是一个 flex item，自动占据剩余空间并居中 */}
      <div className="flex-1 flex flex-col items-center justify-center w-full relative">
        <div 
          className="relative bg-gray-800 rounded-lg shadow-2xl border-4 border-gray-700 transition-all duration-300 ease-in-out"
          style={{ width: mapWidth, height: mapHeight }}
        >
          {/* 静态地图层 */}
          {level.map.map((row, y) => (
            row.map((cell, x) => {
              const isTarget = cell === 2;
              const isWall = cell === 1;
              return (
                <div
                  key={`${x}-${y}`}
                  className={`absolute top-0 left-0 box-border border border-white/5
                    ${isWall ? 'bg-slate-600' : 'bg-slate-800'}
                    ${isTarget ? 'after:content-[""] after:block after:bg-red-500/50 after:rounded-full after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:shadow-[0_0_10px_rgba(239,68,68,0.6)]' : ''}
                  `}
                  style={{ 
                    width: cellSize, 
                    height: cellSize, 
                    transform: `translate(${x * cellSize}px, ${y * cellSize}px)` 
                  }}
                >
                  {isTarget && (
                    <style>{`
                      #target-${x}-${y}::after {
                        width: ${cellSize * 0.25}px;
                        height: ${cellSize * 0.25}px;
                      }
                    `}</style>
                  )}
                  {isTarget && <div id={`target-${x}-${y}`} className="w-full h-full relative after:content-[''] after:absolute after:bg-red-500/50 after:rounded-full after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2" style={{['--target-size' as any]: `${cellSize*0.3}px`}} />}

                  {isWall && <div className="w-full h-full bg-gradient-to-br from-white/10 to-black/30 border-t border-l border-white/10 shadow-inner" />}
                </div>
              );
            })
          ))}

          {/* 箱子层 */}
          {boxes.map((box, i) => {
            const onTarget = level.map[box.y][box.x] === 2;
            return (
              <div
                key={`box-${i}`}
                className={`absolute top-0 left-0 transition-transform ease-in-out z-10 flex items-center justify-center`}
                style={{ 
                  width: cellSize, 
                  height: cellSize, 
                  transform: `translate(${box.x * cellSize}px, ${box.y * cellSize}px)`, 
                  transitionDuration: ANIMATION_DURATION 
                }}
              >
                <div className={`w-5/6 h-5/6 rounded-md shadow-lg border-4 flex items-center justify-center relative transition-colors duration-300
                  ${onTarget ? 'bg-green-600 border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'bg-amber-700 border-amber-500'}
                `}>
                  <div className="absolute inset-2 border-2 border-dashed border-black/10"></div>
                  {onTarget && <span className="text-white font-bold drop-shadow-md" style={{ fontSize: cellSize * 0.4 }}>✓</span>}
                </div>
              </div>
            );
          })}

          {/* 玩家层 */}
          <div
            className="absolute top-0 left-0 transition-transform ease-in-out z-20 flex items-center justify-center"
            style={{ 
              width: cellSize, 
              height: cellSize, 
              transform: `translate(${player.x * cellSize}px, ${player.y * cellSize}px)`, 
              transitionDuration: ANIMATION_DURATION 
            }}
          >
            <div className="w-3/4 h-3/4 bg-blue-500 rounded-full shadow-lg border-4 border-blue-300 relative flex items-center justify-center overflow-hidden transition-all duration-200">
               <div className={`absolute w-full h-full flex gap-[10%] items-center justify-center transition-transform duration-200
                 ${direction === 'up' ? '-translate-y-[15%]' : ''}
                 ${direction === 'down' ? 'translate-y-[15%]' : ''}
                 ${direction === 'left' ? '-translate-x-[15%]' : ''}
                 ${direction === 'right' ? 'translate-x-[15%]' : ''}
               `}>
                 <div className="bg-white rounded-full shadow-sm" style={{ width: '20%', height: '20%' }}></div>
                 <div className="bg-white rounded-full shadow-sm" style={{ width: '20%', height: '20%' }}></div>
               </div>
            </div>
          </div>

          {/* 胜利结算 */}
          {isWon && (
            <div className="absolute inset-0 bg-black/70 z-50 flex flex-col items-center justify-center backdrop-blur-sm animate-fade-in rounded-lg">
              <h2 className="font-bold text-green-400 mb-6 shadow-black drop-shadow-lg tracking-widest animate-bounce" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)' }}>通关!</h2>
              <div className="text-white text-xl animate-pulse">即将进入下一关...</div>
            </div>
          )}
        </div>
      
        {/* 底部控制栏：直接放在 Game Board 的下方，作为 flex-col 的一部分 */}
        <div className="mt-6 z-10 flex gap-3 flex-wrap justify-center w-full max-w-lg">
          <button onClick={prevLevel} disabled={levelIndex===0} className="flex-1 min-w-[80px] py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors font-medium shadow-md text-sm sm:text-base">上一关</button>
          <button onClick={handleUndo} disabled={history.length===0} className="flex-1 min-w-[80px] py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-500 disabled:opacity-50 transition-colors font-medium shadow-md text-sm sm:text-base">撤销</button>
          <button onClick={handleReset} className="flex-1 min-w-[80px] py-3 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors font-medium shadow-md text-sm sm:text-base">重置</button>
          <button onClick={nextLevel} disabled={levelIndex===LEVELS.length-1} className="flex-1 min-w-[80px] py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors font-medium shadow-md text-sm sm:text-base">下一关</button>
        </div>
      </div>
      
      <ARControls 
        enabled={arEnabled} 
        onMove={move} 
        onUndo={handleUndo}
        onPrevLevel={prevLevel}
        onNextLevel={nextLevel}
        onClose={() => setAREnabled(false)} 
      />
      
      <div className="mt-2 text-gray-500 text-xs bg-gray-800/50 px-4 py-2 rounded-full flex-shrink-0">
        WASD / 方向键移动 • Ctrl+Z 撤销
      </div>
    </div>
  );
};
