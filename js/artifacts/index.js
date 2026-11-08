import { kaen } from './kaen.js';

// ステージの順番。新しい出土品はここに追加する（available: true で遊べるようになる）。
export const STAGES = [
  { ...kaen, pieces: 12 },
  { id: 'dogu', name: '遮光器土偶', ruby: 'しゃこうきどぐう', kind: '土偶', era: '縄文時代晩期', available: false },
  { id: 'haniwa', name: '踊る人々（埴輪）', ruby: 'はにわ', kind: '埴輪', era: '古墳時代', available: false },
];
