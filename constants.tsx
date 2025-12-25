
import { ChildProfile } from './types';

export const INITIAL_PROFILES: ChildProfile[] = [
  { id: '1', name: '小如', avatar: '👧', cards: [] }, // 姐姐
  { id: '2', name: '小峻', avatar: '👦', cards: [] }  // 弟弟
];

/**
 * 艾宾浩斯遗忘曲线复习间隔（天）
 * 阶段 0: 新记录（当日/次日复习）
 * 阶段 1: +1天
 * 阶段 2: +2天
 * 阶段 3: +4天
 * 阶段 4: +7天
 * 阶段 5: +15天
 * 阶段 6: +31天（进入长期记忆）
 */
export const SRS_INTERVALS = [0, 1, 2, 4, 7, 15, 31];
