/**
 * SM-2 Spaced Repetition Algorithm
 * Quality ratings:
 * 0 = Forgot completely
 * 3 = Hard (correct with difficulty)
 * 5 = Easy (perfect recall)
 */
export interface SRSData {
  easeFactor: number;    // Starts at 2.5
  interval: number;      // Days until next review
  reviewCount: number;   // Total times reviewed
  nextReviewDate: string; // ISO date string
}

/**
 * MochiVocab 5-Level Spaced Repetition Algorithm
 * Quality ratings:
 * 0 = Forgot completely (Drops to Level 1)
 * 3/5 = Hard/Easy (Advances 1 Level, max 5)
 */
export interface SRSData {
  easeFactor: number;    // Unused in 5-level but kept for DB compat
  interval: number;      // Days until next review
  reviewCount: number;   // Acts as the "Level" (1-5)
  nextReviewDate: string; // Full ISO string for precise 12h timings
}

export function calculateNextReview(current: SRSData, quality: 0 | 3 | 4 | 5): SRSData {
  let { reviewCount } = current;

  if (quality === 0) {
    // Forgot → Reset to Level 1
    reviewCount = 1;
  } else if (quality === 5) {
    // Mastered → Jump to Level 5 (Minimum) or Level 6 if already at Level 5
    reviewCount = Math.max(5, (reviewCount || 0) + 1);
    if (reviewCount > 6) reviewCount = 6;
  } else {
    // Correct (4) or Hard (3) → Advance 1 Level (Max 6)
    reviewCount = Math.min(6, (reviewCount || 0) + 1);
    if (reviewCount === 0) reviewCount = 1;
  }

  // DEBUG MODE: Intervals in SECONDS for easy testing
  let intervalSeconds = 15; // Level 1: 15s
  if (reviewCount === 2) intervalSeconds = 30; // Level 2: 30s
  else if (reviewCount === 3) intervalSeconds = 60; // Level 3: 60s
  else if (reviewCount === 4) intervalSeconds = 120; // Level 4: 120s
  else if (reviewCount === 5) intervalSeconds = 240; // Level 5: 240s
  else if (reviewCount === 6) intervalSeconds = 480; // Level 6: 480s (8m recall)

  const nextDate = new Date();
  nextDate.setSeconds(nextDate.getSeconds() + intervalSeconds);

  return {
    easeFactor: 2.5,
    interval: intervalSeconds / 86400, // Store as fraction of day for DB
    reviewCount,
    nextReviewDate: nextDate.toISOString(),
  };
}

export function defaultSRS(): SRSData {
  const nextDate = new Date();
  nextDate.setSeconds(nextDate.getSeconds() + 15); // Default Level 1 is 15s for testing
  return {
    easeFactor: 2.5,
    interval: 15 / 86400,
    reviewCount: 1, // Start at Level 1
    nextReviewDate: nextDate.toISOString(),
  };
}

export function isDueToday(nextReviewDate: string): boolean {
  if (!nextReviewDate) return true;
  const now = Date.now();
  const next = new Date(nextReviewDate).getTime();
  return next <= now;
}
