import { kaen } from './kaen.js';
import { dogu } from './dogu.js';
import { venus } from './venus.js';

// ステージの順番。新しい出土品はここに追加する（available: true で遊べるようになる）。
export const STAGES = [
  { ...kaen, pieces: 12 },
  { ...dogu, pieces: 14 },
  { ...venus, pieces: 14 },
  { id: 'haniwa', name: '踊る人々（埴輪）', ruby: 'はにわ', kind: '埴輪', era: '古墳時代', available: false },
];
