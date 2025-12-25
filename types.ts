
export interface Flashcard {
  id: string;
  character: string;
  pinyin: string;
  meaning: string;
  srsStage: number; // 0-5 级掌握程度
  nextReviewDate: number; // 时间戳
  createdAt: number;
}

export interface ChildProfile {
  id: string;
  name: string;
  avatar: string;
  cards: Flashcard[];
}

export type AppView = 'HOME' | 'LEARN' | 'RECORD' | 'LIST';
