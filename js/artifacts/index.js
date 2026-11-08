import { kaen } from './kaen.js';
import { dogu } from './dogu.js';
import { venus } from './venus.js';
import { megami } from './megami.js';
import { tora } from './tora.js';

// ステージの順番。新しい出土品はここに追加する（available: true で遊べるようになる）。
export const STAGES = [
  { ...kaen, pieces: 12 },
  { ...dogu, pieces: 14 },
  { ...venus, pieces: 14 },
  { ...megami, pieces: 16 },
  { ...tora, pieces: 14 },
];
