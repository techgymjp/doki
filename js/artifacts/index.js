import { kaen } from './kaen.js';
import { dogu } from './dogu.js';
import { venus } from './venus.js';
import { megami } from './megami.js';
import { tora } from './tora.js';
import { uma } from './uma.js';
import { bujin } from './bujin.js';
import { heart } from './heart.js';
import { odoru } from './odoru.js';

// ステージの順番。新しい出土品はここに追加する（available: true で遊べるようになる）。
// level が上がるほど、ピースが増え、はまる判定がきびしくなり、ガイドがうすくなる。
export const STAGES = [
  { ...kaen, pieces: 10, level: 1 },
  { ...dogu, pieces: 12, level: 2 },
  { ...venus, pieces: 14, level: 3 },
  { ...megami, pieces: 16, level: 4 },
  { ...tora, pieces: 18, level: 5 },
  { ...uma, pieces: 20, level: 6 },
  { ...bujin, pieces: 22, level: 7 },
  { ...heart, pieces: 22, level: 8 },
  { ...odoru, pieces: 24, level: 9 },
];
