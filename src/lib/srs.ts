import { FlashcardSRS } from "@/types/course";

/**
 * SuperMemo-2 (SM-2) Spaced Repetition Algorithm
 * quality:
 * 0 - Quên hoàn toàn (Again)
 * 3 - Nhớ mang máng / Khó (Hard)
 * 4 - Nhớ tốt (Good)
 * 5 - Nhớ cực nhanh & dễ (Easy)
 */
export function calculateNextReview(
  card: FlashcardSRS,
  quality: 0 | 3 | 4 | 5
): FlashcardSRS {
  let { interval, repetition, efactor } = card;

  if (quality >= 3) {
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 3;
    } else {
      interval = Math.round(interval * efactor);
    }
    repetition += 1;
  } else {
    repetition = 0;
    interval = 0; // Review again today / in a few minutes
  }

  efactor = efactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (efactor < 1.3) {
    efactor = 1.3;
  }

  const nextDate = new Date();
  if (interval === 0) {
    // 10 minutes later
    nextDate.setMinutes(nextDate.getMinutes() + 10);
  } else {
    nextDate.setDate(nextDate.getDate() + interval);
  }

  return {
    ...card,
    interval,
    repetition,
    efactor: Number(efactor.toFixed(2)),
    nextReviewDate: nextDate.toISOString(),
    lastReviewedAt: new Date().toISOString(),
  };
}
