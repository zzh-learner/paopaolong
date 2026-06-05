export const SCORE_PER_POPPED_BUBBLE = 10;
export const SCORE_PER_DROPPED_BUBBLE = 20;

export function calculatePopScore(count) {
  return count * SCORE_PER_POPPED_BUBBLE;
}

export function calculateDropScore(count) {
  return count * SCORE_PER_DROPPED_BUBBLE;
}
