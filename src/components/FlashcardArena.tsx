"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Volume2,
  RotateCw,
  Clock,
  Sparkles,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  Mic,
  Star,
} from "lucide-react";
import { FlashcardSRS } from "@/types/course";
import { calculateNextReview } from "@/lib/srs";
import {
  updateFlashcard,
  getStarredVocabIds,
  toggleStarredVocabId,
  normalizeStarVocabKey,
} from "@/lib/storage";
import { speakSmart, stopAllSpeech } from "@/lib/tts";
import { triggerChibiCelebrate } from "@/lib/chibiEvents";
import AudioSpeakButton from "./AudioSpeakButton";
import PronunciationModal from "./PronunciationModal";

interface FlashcardArenaProps {
  cards: FlashcardSRS[];
  onCardsUpdated: () => void;
}

export default function FlashcardArena({
  cards,
  onCardsUpdated,
}: FlashcardArenaProps) {
  const [deck, setDeck] = useState<FlashcardSRS[]>(cards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const [isPronounceOpen, setIsPronounceOpen] = useState(false);
  const [vocabFilter, setVocabFilter] = useState<"all" | "starred">("all");
  const [starredKeys, setStarredKeys] = useState<string[]>([]);

  // Mobile touch-swipe gesture state & refs
  const [touchDeltaX, setTouchDeltaX] = useState(0);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isHorizontalSwipeRef = useRef(false);
  const didSwipeRef = useRef(false);
  const pillsContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const syncStarred = () => setStarredKeys(getStarredVocabIds());
    syncStarred();
    window.addEventListener("bookmind:starred-updated", syncStarred);
    return () => {
      window.removeEventListener("bookmind:starred-updated", syncStarred);
    };
  }, []);

  const starredCardsCount = cards.filter((c) =>
    starredKeys.includes(normalizeStarVocabKey(c.word))
  ).length;

  useEffect(() => {
    if (vocabFilter === "starred") {
      const starredSubset = cards.filter((c) =>
        starredKeys.includes(normalizeStarVocabKey(c.word))
      );
      if (starredSubset.length > 0) {
        setDeck(starredSubset);
        setCurrentIndex((prev) =>
          prev >= starredSubset.length ? 0 : prev
        );
      } else {
        // Auto-fallback to all cards if user unstars the last item
        setVocabFilter("all");
        setDeck(cards);
      }
    } else {
      setDeck(cards);
    }
  }, [cards, vocabFilter, starredKeys]);

  // Stop speech whenever card changes or component unmounts, and center active pill
  useEffect(() => {
    stopAllSpeech();
    const container = pillsContainerRef.current;
    if (container) {
      const activeBtn = container.children[
        currentIndex % Math.max(1, deck.length)
      ] as HTMLElement | undefined;
      if (activeBtn && typeof activeBtn.scrollIntoView === "function") {
        activeBtn.scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        });
      }
    }
    return () => {
      stopAllSpeech();
    };
  }, [currentIndex, deck.length]);

  // Keyboard navigation: Left/Right arrows to switch cards, Space to flip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }
      if (deck.length === 0) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        setIsFlipped(false);
        setCurrentIndex((prev) => (prev + 1) % deck.length);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIsFlipped(false);
        setCurrentIndex((prev) => (prev - 1 + deck.length) % deck.length);
      } else if (e.key === " ") {
        e.preventDefault();
        setIsFlipped((f) => !f);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deck.length]);

  if (deck.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center">
        <BookOpen className="mx-auto mb-3 h-10 w-10 text-slate-500" />
        <h3 className="text-base font-semibold text-white">
          Chưa có thẻ Flashcard nào trong mục này
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Hãy bấm tạo bài học AI ở Chương bất kỳ để hệ thống tự động trích xuất từ vựng và tạo bộ Flashcard SRS.
        </p>
      </div>
    );
  }

  const safeIndex = currentIndex % deck.length;
  const currentCard = deck[safeIndex];

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + deck.length) % deck.length);
  };

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % deck.length);
  };

  const handleShuffle = () => {
    const copy = [...deck].sort(() => Math.random() - 0.5);
    setDeck(copy);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const handleGrade = async (quality: 0 | 3 | 4 | 5) => {
    const updated = calculateNextReview(currentCard, quality);
    await updateFlashcard(updated);
    setIsFlipped(false);
    const nextReviewed = sessionReviewed + 1;
    setSessionReviewed(nextReviewed);
    onCardsUpdated();
    setCurrentIndex((prev) => (prev + 1) % deck.length);

    if (
      quality >= 4 &&
      deck.length > 0 &&
      (nextReviewed === deck.length || nextReviewed % 5 === 0)
    ) {
      triggerChibiCelebrate({
        badge: "🔥 ÔN THẺ QUÁ CHĂM!",
        message: `HOAN HÔ!! Đã nhớ tốt ${nextReviewed} thẻ Flashcard rồi!! Hát mừng nào~ 🎵🎉`,
        subtext: "Trí nhớ SRS của bạn đang lên cấp vù vù!",
      });
    }
  };

  const handleCardTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    // Bỏ qua swipe nếu người dùng chạm vào nút Loa / Luyện nói bên trong thẻ
    if ((e.target as HTMLElement).closest("button")) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      return;
    }
    const touch = e.touches[0];
    if (!touch) return;
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    isHorizontalSwipeRef.current = false;
    didSwipeRef.current = false;
    setTouchDeltaX(0);
  };

  const handleCardTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) {
      return;
    }
    const touch = e.touches[0];
    if (!touch) return;
    const dx = touch.clientX - touchStartXRef.current;
    const dy = touch.clientY - touchStartYRef.current;

    if (!isHorizontalSwipeRef.current) {
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        isHorizontalSwipeRef.current = true;
      } else if (Math.abs(dy) > 12) {
        // Người dùng đang cuộn dọc trang -> hủy theo dõi vuốt ngang
        touchStartXRef.current = null;
        return;
      }
    }

    if (isHorizontalSwipeRef.current) {
      setTouchDeltaX(dx);
    }
  };

  const handleCardTouchEnd = () => {
    if (touchStartXRef.current === null) {
      setTouchDeltaX(0);
      return;
    }
    if (touchDeltaX <= -45) {
      didSwipeRef.current = true;
      handleNext();
    } else if (touchDeltaX >= 45) {
      didSwipeRef.current = true;
      handlePrev();
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isHorizontalSwipeRef.current = false;
    setTouchDeltaX(0);
  };

  return (
    <div className="space-y-4">
      {/* Top Status & Quick Word Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] px-4 py-2.5 text-xs shadow-[4px_4px_0_0_#F5EFE6]">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-extrabold text-[#F3C969]">
            Từ {safeIndex + 1} / {deck.length}
          </span>
          <span className="rounded-full border-2 border-[#F5EFE6] bg-[#A7D7A9] px-2.5 py-0.5 font-extrabold text-[#141413]">
            Đã đánh giá SRS: {sessionReviewed}
          </span>
          <button
            type="button"
            onClick={handleShuffle}
            className="flex items-center gap-1 rounded-xl border-2 border-[#F5EFE6] bg-[#141413] px-2.5 py-1 font-bold text-[#F5EFE6] shadow-[2px_2px_0_0_#F5EFE6] transition-transform hover:bg-[#C8B6FF] hover:text-[#141413] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
            title="Trộn ngẫu nhiên thứ tự thẻ"
          >
            <Shuffle className="h-3.5 w-3.5" />
            Trộn thẻ
          </button>
        </div>
        <div className="flex items-center gap-2 text-[#B8B2A6]">
          <Clock className="h-3.5 w-3.5 text-[#F3C969]" />
          <span>
            Chu kỳ nhớ: <strong className="text-[#F5EFE6]">{currentCard.interval} ngày</strong> (Hệ số:{" "}
            {currentCard.efactor})
          </span>
        </div>
      </div>

      {/* Quick Jump Word Pills */}
      <div
        ref={pillsContainerRef}
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1"
      >
        {deck.map((c, idx) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setCurrentIndex(idx);
              setIsFlipped(false);
            }}
            className={`shrink-0 rounded-lg border-2 px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer ${
              idx === safeIndex
                ? "border-[#F5EFE6] bg-[#F3C969] text-[#141413]"
                : "border-[#3A3832] bg-[#1D1C19] text-[#B8B2A6] hover:border-[#F5EFE6] hover:text-[#F5EFE6]"
            }`}
          >
            {idx + 1}. {c.word}
          </button>
        ))}
      </div>

      {/* Interactive Flashcard (Supports Touch Swipe Left/Right on Mobile) */}
      <div
        onTouchStart={handleCardTouchStart}
        onTouchMove={handleCardTouchMove}
        onTouchEnd={handleCardTouchEnd}
        onTouchCancel={handleCardTouchEnd}
        onClick={() => {
          if (didSwipeRef.current) {
            didSwipeRef.current = false;
            return;
          }
          setIsFlipped(!isFlipped);
        }}
        style={{
          transform:
            touchDeltaX !== 0
              ? `translateX(${Math.max(-90, Math.min(90, touchDeltaX * 0.4))}px)`
              : undefined,
          transition:
            touchDeltaX !== 0 ? "none" : "transform 200ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        className="group relative min-h-[270px] sm:min-h-[290px] touch-pan-y cursor-pointer select-none rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-4 sm:p-7 shadow-[4px_4px_0_0_#F5EFE6]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full border-2 border-[#F5EFE6] bg-[#C8B6FF] px-3 py-0.5 text-xs font-extrabold text-[#141413] shadow-[2px_2px_0_0_#F5EFE6]">
            CEFR {currentCard.cefrLevel} • {currentCard.partOfSpeech}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-[#B8B2A6] group-hover:text-[#F3C969]">
            <RotateCw className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">
              {isFlipped
                ? "Bấm vào thẻ (hoặc phím Space) để xem mặt trước"
                : "Bấm vào thẻ (hoặc phím Space) để lật xem nghĩa"}
            </span>
            <span className="sm:hidden">
              Vuốt trái/phải đổi từ • Chạm lật nghĩa
            </span>
          </span>
        </div>

        {!isFlipped ? (
          /* Front of Card */
          <div className="flex min-h-[200px] flex-col items-center justify-center text-center py-2">
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F5EFE6] md:text-4xl break-words">
                {currentCard.word}
              </h2>
              <AudioSpeakButton
                text={currentCard.word}
                showLabel={false}
                className="rounded-xl border-2 border-[#F5EFE6] bg-[#B8D8F8] p-2.5 text-[#141413] shadow-[2px_2px_0_0_#F5EFE6] transition-transform active:translate-x-[1px] active:translate-y-[1px]"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  stopAllSpeech();
                  setIsPronounceOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-3 py-2 text-xs font-extrabold text-[#141413] shadow-[2px_2px_0_0_#F5EFE6] transition-transform active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                title="Bấm để luyện đọc từ này cho AI chấm điểm"
              >
                <Mic className="h-4 w-4 shrink-0" />
                <span>Luyện nói</span>
              </button>
            </div>
            <p className="mt-2 font-mono text-sm sm:text-base font-bold text-[#F3C969]">
              {currentCard.ipa}
            </p>
            <div className="mt-5 flex items-center justify-between gap-3 w-full max-w-xl rounded-lg border-2 border-[#3A3832] bg-[#141413] px-3.5 py-3 text-xs sm:text-sm italic text-[#F5EFE6] text-left">
              <span className="flex-1 break-words">&ldquo;{currentCard.quoteFromBook}&rdquo;</span>
              <AudioSpeakButton
                text={currentCard.quoteFromBook}
                showLabel={false}
                className="shrink-0 rounded-lg border-2 border-[#F5EFE6] bg-[#B8D8F8] p-1.5 text-[#141413]"
              />
            </div>
          </div>
        ) : (
          /* Back of Card */
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#3A3832] pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg sm:text-xl font-extrabold text-[#F5EFE6] break-words">
                  {currentCard.word}
                </span>
                <span className="font-mono text-xs sm:text-sm font-bold text-[#F3C969]">
                  {currentCard.ipa}
                </span>
                <AudioSpeakButton
                  text={currentCard.word}
                  showLabel={false}
                  className="rounded-lg border-2 border-[#F5EFE6] bg-[#B8D8F8] p-1.5 text-[#141413]"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    stopAllSpeech();
                    setIsPronounceOpen(true);
                  }}
                  className="flex items-center gap-1 rounded-lg border-2 border-[#F5EFE6] bg-[#A7D7A9] px-2.5 py-1 text-xs font-extrabold text-[#141413]"
                  title="Luyện nói từ này"
                >
                  <Mic className="h-3 w-3 shrink-0" />
                  <span>Chấm nói AI</span>
                </button>
              </div>
              <AudioSpeakButton
                text={currentCard.quoteFromBook}
                label="Đọc câu gốc"
                className="rounded-xl border-2 border-[#F5EFE6] bg-[#141413] px-3 py-1 text-xs font-bold text-[#F5EFE6] hover:bg-[#B8D8F8] hover:text-[#141413]"
              />
            </div>

            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#A7D7A9]">
                Nghĩa tiếng Việt trong ngữ cảnh:
              </div>
              <p className="mt-1 text-lg font-extrabold text-[#F5EFE6]">
                {currentCard.vietnameseMeaning}
              </p>
            </div>

            <div
              key={`flash-back-${currentCard.id}`}
              className="space-y-3 bm-flashcard-3d"
            >
              <div className="rounded-lg border-2 border-[#3A3832] bg-[#141413] p-3.5 text-xs leading-relaxed text-[#F5EFE6]">
                <strong className="text-[#C8B6FF]">Giải thích sâu: </strong>
                {currentCard.explanationInContext}
              </div>

              <div className="rounded-lg border-2 border-[#3A3832] bg-[#141413] p-3.5 text-xs">
                <p className="italic text-[#F5EFE6]">
                  &ldquo;{currentCard.quoteFromBook}&rdquo;
                </p>
                <p className="mt-1 text-[#B8B2A6]">
                  → {currentCard.quoteTranslation}
                </p>
              </div>

              {currentCard.collocations && currentCard.collocations.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {currentCard.collocations.map((col, idx) => (
                    <span
                      key={idx}
                      className="rounded-lg border-2 border-[#3A3832] bg-[#141413] px-2.5 py-1 text-[11px] font-semibold text-[#F5EFE6]"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Filter & Star Hard-Word Bar */}
      {(() => {
        const isCurrentStarred = starredKeys.includes(
          normalizeStarVocabKey(currentCard.word)
        );
        return (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] px-3 py-2 shadow-[4px_4px_0_0_#F5EFE6]">
            <div className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#3A3832] bg-[#141413] p-1">
              <button
                type="button"
                onClick={() => {
                  setVocabFilter("all");
                  setCurrentIndex(0);
                  setIsFlipped(false);
                }}
                className={`min-h-[34px] rounded-md px-3 py-1 text-xs font-extrabold transition-colors cursor-pointer ${
                  vocabFilter === "all"
                    ? "bg-[#F3C969] text-[#141413]"
                    : "text-[#B8B2A6] hover:text-[#F5EFE6]"
                }`}
              >
                Tất cả ({cards.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  if (starredCardsCount === 0) return;
                  setVocabFilter("starred");
                  setCurrentIndex(0);
                  setIsFlipped(false);
                }}
                disabled={starredCardsCount === 0}
                title={
                  starredCardsCount === 0
                    ? "Hãy bấm nút ⭐ Đánh dấu từ khó để lọc danh sách ôn tập riêng"
                    : "Chỉ ôn các từ khó đã đánh dấu sao"
                }
                className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-md px-3 py-1 text-xs font-extrabold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                  vocabFilter === "starred"
                    ? "bg-[#F3C969] text-[#141413]"
                    : "text-[#B8B2A6] hover:text-[#F3C969]"
                }`}
              >
                <Star className={`h-3.5 w-3.5 ${vocabFilter === "starred" ? "fill-[#141413] text-[#141413]" : "fill-[#F3C969] text-[#F3C969]"}`} />
                <span>Từ khó ({starredCardsCount})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                const res = toggleStarredVocabId(currentCard.word);
                setStarredKeys(res.starredIds);
              }}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] px-3.5 py-1.5 text-xs font-extrabold shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer ${
                isCurrentStarred
                  ? "bg-[#F3C969] text-[#141413]"
                  : "bg-[#141413] text-[#F5EFE6] hover:bg-[#2A2823]"
              }`}
            >
              <Star
                className={`h-3.5 w-3.5 ${
                  isCurrentStarred
                    ? "fill-[#141413] text-[#141413]"
                    : "text-[#F3C969]"
                }`}
              />
              <span>
                {isCurrentStarred ? "Đã lưu Từ khó" : "Đánh dấu Từ khó"}
              </span>
            </button>
          </div>
        );
      })()}

      {/* Explicit Previous / Flip / Next Navigation Controls */}
      <div className="grid grid-cols-3 gap-2.5 rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-2.5 shadow-[4px_4px_0_0_#F5EFE6]">
        <button
          type="button"
          onClick={handlePrev}
          className="flex min-h-[42px] items-center justify-center gap-1 rounded-xl border-2 border-[#F5EFE6] bg-[#141413] px-2.5 sm:px-4 py-2 text-xs font-bold text-[#F5EFE6] shadow-[3px_3px_0_0_#F5EFE6] transition-transform hover:bg-[#2A2823] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4 text-[#F3C969] shrink-0" />
          <span className="truncate">Từ trước</span>
        </button>

        <button
          type="button"
          onClick={() => setIsFlipped(!isFlipped)}
          className="flex min-h-[42px] items-center justify-center gap-1 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-2.5 sm:px-4 py-2 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
        >
          <RotateCw className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {isFlipped ? "Mặt trước" : "Lật nghĩa"}
          </span>
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="flex min-h-[42px] items-center justify-center gap-1 rounded-xl border-2 border-[#F5EFE6] bg-[#141413] px-2.5 sm:px-4 py-2 text-xs font-bold text-[#F5EFE6] shadow-[3px_3px_0_0_#F5EFE6] transition-transform hover:bg-[#2A2823] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
        >
          <span className="truncate">Tiếp theo</span>
          <ChevronRight className="h-4 w-4 text-[#F3C969] shrink-0" />
        </button>
      </div>

      {/* SRS Rating Buttons */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <button
          type="button"
          onClick={() => handleGrade(0)}
          className="flex flex-col items-center rounded-xl border-2 border-[#F5EFE6] bg-[#FF8A8A] py-2.5 px-2 text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
        >
          <span className="text-xs font-extrabold">Quên (Again)</span>
          <span className="text-[11px] font-semibold text-[#141413]/80">Ôn lại sau 10 phút</span>
        </button>
        <button
          type="button"
          onClick={() => handleGrade(3)}
          className="flex flex-col items-center rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] py-2.5 px-2 text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
        >
          <span className="text-xs font-extrabold">Nhớ mang máng (Hard)</span>
          <span className="text-[11px] font-semibold text-[#141413]/80">Ôn sau 1 ngày</span>
        </button>
        <button
          type="button"
          onClick={() => handleGrade(4)}
          className="flex flex-col items-center rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] py-2.5 px-2 text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
        >
          <span className="text-xs font-extrabold">Nhớ tốt (Good)</span>
          <span className="text-[11px] font-semibold text-[#141413]/80">
            Ôn sau{" "}
            {currentCard.repetition === 0
              ? 1
              : currentCard.repetition === 1
              ? 3
              : Math.round(currentCard.interval * currentCard.efactor)}{" "}
            ngày
          </span>
        </button>
        <button
          type="button"
          onClick={() => handleGrade(5)}
          className="flex flex-col items-center rounded-xl border-2 border-[#F5EFE6] bg-[#B8D8F8] py-2.5 px-2 text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
        >
          <span className="flex items-center gap-1 text-xs font-extrabold">
            <Sparkles className="h-3.5 w-3.5" />
            Thuộc làu (Easy)
          </span>
          <span className="text-[11px] font-semibold text-[#141413]/80">
            Tăng mạnh chu kỳ SRS
          </span>
        </button>
      </div>

      {/* AI Pronunciation Coach Modal */}
      {currentCard && (
        <PronunciationModal
          isOpen={isPronounceOpen}
          onClose={() => setIsPronounceOpen(false)}
          targetText={currentCard.word}
          phonetic={currentCard.ipa}
          vietnameseMeaning={currentCard.vietnameseMeaning}
          contextHint={`Ví dụ: ${currentCard.quoteFromBook}`}
        />
      )}
    </div>
  );
}
