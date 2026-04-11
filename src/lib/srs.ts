/**
 * LingoPro SRS Algorithm — Powered by FSRS v5 (Free Spaced Repetition Scheduler)
 * 
 * References:
 * https://github.com/open-spaced-repetition/fsrs4anki/wiki/ABC-of-FSRS
 */

export interface SRSData {
  stability: number;       // S: Days for retention to drop to 90%
  difficulty: number;      // D: 1 (easy) to 10 (hard)
  interval: number;        // Calculated days until next review
  reviewCount: number;     // Number of successful reviews
  nextReviewDate: string;  // ISO string
  lastReviewDate?: string; // ISO string of previous review
}

/**
 * Default FSRS v5 weights (Baseline optimized on millions of reviews)
 */
const W = [
  0.4025, 1.4612, 3.8738, 11.0,  // Initial stability for Again, Hard, Good, Easy
  4.93, 0.94, 0.86,              // Difficulty update weights
  0.01, 1.49, 0.14,              // Stability update weights (Success)
  0.94, 2.18, 0.05, 0.34, 1.26,  // Stability update weights (Failure)
  0.29, 2.61,                    // Retrievability impact
  0.05, 0.5                      // Same-day review penalty (for completeness)
];

const TARGET_RETENTION = 0.9; // Aim for 90% recall probability
const DECAY = -0.1; // -log10(0.9) approx for power law or exp

/**
 * Ratings mapping:
 * 1: Again (Forgot)
 * 2: Hard
 * 3: Good
 * 4: Easy (Mastered)
 */
export type FSRSRating = 1 | 2 | 3 | 4;

/**
 * Calculates Retrievability (R) at time t given Stability (S)
 * Formula: R = (1 + t / (9 * S))^-1  (Power law version used in FSRS v5)
 */
export function calculateRetrievability(daysSinceLastReview: number, stability: number): number {
  return Math.pow(1 + daysSinceLastReview / (9 * stability), -1);
}

/**
 * Calculates Next Interval (I) based on Stability (S) and Desired Retention
 * I = 9 * S * (R^-1 - 1)
 */
export function calculateInterval(stability: number, retention: number = TARGET_RETENTION): number {
  return Math.max(1, Math.round(9 * stability * (1 / retention - 1)));
}

export function calculateNextReview(current: SRSData, rating: FSRSRating): SRSData {
  let { stability, difficulty, reviewCount, lastReviewDate } = current;
  
  // 1. Initial review handling (if stability is 0)
  if (stability === 0) {
    stability = W[rating - 1];
    difficulty = Math.max(1, Math.min(10, W[4] - (rating - 3) * W[5]));
    reviewCount = rating > 1 ? 1 : 0;
  } else {
    // 2. Existing card update
    const now = new Date();
    const last = lastReviewDate ? new Date(lastReviewDate) : new Date();
    const elapsedDays = Math.max(0, (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    const retrievability = calculateRetrievability(elapsedDays, stability);

    // Update Difficulty
    difficulty = Math.max(1, Math.min(10, difficulty - W[6] * (rating - 3)));

    if (rating > 1) {
      // Success update
      const stabilityIncrease = 1 + Math.exp(W[8]) * (11 - difficulty) * Math.pow(stability, -W[9]) * (Math.exp(W[10] * (1 - retrievability)) - 1);
      stability = stability * stabilityIncrease;
      reviewCount++;
    } else {
      // Failure (Again)
      const stabilityDecrease = Math.max(0.1, W[11] * Math.pow(difficulty, -W[12]) * (Math.pow(stability + 1, W[13]) - 1) * Math.exp(W[14] * (1 - retrievability)));
      stability = stabilityDecrease;
      reviewCount = 0; // Reset count or treat as lapse
    }
  }

  const intervalDays = calculateInterval(stability);
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + intervalDays);

  return {
    stability,
    difficulty,
    interval: intervalDays,
    reviewCount,
    nextReviewDate: nextDate.toISOString(),
    lastReviewDate: new Date().toISOString(),
  };
}

export function defaultSRS(): SRSData {
  return {
    stability: 0,
    difficulty: 0,
    interval: 0,
    reviewCount: 0,
    nextReviewDate: new Date().toISOString(),
  }
}

/** Maps LingoPro button quality (0,3,4,5) to FSRS Rating (1,2,3,4) */
export function mapQualityToRating(quality: number): FSRSRating {
  if (quality === 0) return 1; // Again
  if (quality === 3) return 2; // Hard
  if (quality === 4) return 3; // Good
  return 4; // Mastered -> Easy
}

/** 
 * Maps Stability to virtual Levels (1-6) for Dashboard visualization 
 * Based on Typical Anki/Mochi interval progression
 */
export function stabilityToLevel(stability: number): number {
  if (stability < 2) return 1;
  if (stability < 5) return 2;
  if (stability < 10) return 3;
  if (stability < 30) return 4;
  if (stability < 90) return 5;
  return 6;
}
