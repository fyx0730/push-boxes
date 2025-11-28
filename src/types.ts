export type Position = {
  x: number;
  y: number;
};

export type TileType = 0 | 1 | 2;

export type LevelData = {
  map: TileType[][];
  player: Position;
  boxes: Position[];
};

export type GameState = {
  levelIndex: number;
  moves: number;
  player: Position;
  boxes: Position[];
  isWon: boolean;
};
