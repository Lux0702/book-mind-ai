export interface ChibiCelebrateDetail {
  badge?: string;
  message?: string;
  subtext?: string;
  durationMs?: number;
}

/**
 * Kích hoạt hoạt cảnh Pixel Chibi nhảy nhót la hát chúc mừng
 * khi người dùng hoàn thành tốt bài học, chương, bài dịch, Flashcard hoặc bài thi.
 */
export function triggerChibiCelebrate(
  detail: ChibiCelebrateDetail = {}
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ChibiCelebrateDetail>("bookmind:chibi-celebrate", {
      detail,
    })
  );
}
