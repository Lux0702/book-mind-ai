"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { FlashcardSRS } from "@/types/course";
import { calculateNextReview } from "@/lib/srs";
import { updateFlashcard } from "@/lib/storage";
import { speakSmart, stopAllSpeech } from "@/lib/tts";
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

  useEffect(() => {
    setDeck(cards);
  }, [cards]);

  // Stop speech whenever card changes or component unmounts
  useEffect(() => {
    stopAllSpeech();
    return () => {
      stopAllSpeech();
    };
  }, [currentIndex]);

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
    setSessionReviewed((s) => s + 1);
    onCardsUpdated();
    setCurrentIndex((prev) => (prev + 1) % deck.length);
  };

  return (
    <div className="space-y-4">
      {/* Top Status & Quick Word Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-bold text-indigo-300">
            Từ {safeIndex + 1} / {deck.length}
          </span>
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-emerald-300">
            Đã đánh giá SRS: {sessionReviewed}
          </span>
          <button
            type="button"
            onClick={handleShuffle}
            className="flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-slate-300 hover:bg-slate-700 hover:text-white"
            title="Trộn ngẫu nhiên thứ tự thẻ"
          >
            <Shuffle className="h-3.5 w-3.5 text-indigo-400" />
            Trộn thẻ
          </button>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Clock className="h-3.5 w-3.5 text-amber-400" />
          <span>
            Chu kỳ nhớ: <strong>{currentCard.interval} ngày</strong> (Hệ số:{" "}
            {currentCard.efactor})
          </span>
        </div>
      </div>

      {/* Quick Jump Word Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {deck.map((c, idx) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setCurrentIndex(idx);
              setIsFlipped(false);
            }}
            className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
              idx === safeIndex
                ? "border-indigo-500 bg-indigo-600 text-white"
                : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            {idx + 1}. {c.word}
          </button>
        ))}
      </div>

      {/* Interactive Flashcard */}
      <div
        onClick={() => setIsFlipped(!isFlipped)}
        className="group relative min-h-[270px] sm:min-h-[290px] cursor-pointer select-none rounded-2xl border border-white/[0.08] bg-[#0F1523]/95 p-4 sm:p-7 shadow-xl transition hover:border-indigo-500/40"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-300">
            CEFR {currentCard.cefrLevel} • {currentCard.partOfSpeech}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-400 group-hover:text-indigo-300">
            <RotateCw className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">
              {isFlipped
                ? "Bấm vào thẻ (hoặc phím Space) để xem mặt trước"
                : "Bấm vào thẻ (hoặc phím Space) để lật xem nghĩa"}
            </span>
            <span className="sm:hidden">
              {isFlipped ? "Chạm để xem từ" : "Chạm để lật nghĩa"}
            </span>
          </span>
        </div>

        {!isFlipped ? (
          /* Front of Card */
          <div className="flex min-h-[200px] flex-col items-center justify-center text-center py-2">
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white md:text-4xl break-words">
                {currentCard.word}
              </h2>
              <AudioSpeakButton
                text={currentCard.word}
                showLabel={false}
                className="rounded-xl bg-indigo-600/25 p-2.5 text-indigo-300 transition hover:bg-indigo-600 hover:text-white"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  stopAllSpeech();
                  setIsPronounceOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 transition cursor-pointer"
                title="Bấm để luyện đọc từ này cho AI chấm điểm"
              >
                <Mic className="h-4 w-4 shrink-0" />
                <span>Luyện nói</span>
              </button>
            </div>
            <p className="mt-2 font-mono text-sm sm:text-base text-indigo-300">
              {currentCard.ipa}
            </p>
            <div className="mt-5 flex items-center justify-between gap-3 w-full max-w-xl rounded-xl border border-white/[0.07] bg-slate-950/70 px-3.5 py-3 text-xs sm:text-sm italic text-slate-300 text-left">
              <span className="flex-1 break-words">&ldquo;{currentCard.quoteFromBook}&rdquo;</span>
              <AudioSpeakButton
                text={currentCard.quoteFromBook}
                showLabel={false}
                className="shrink-0 rounded-lg bg-slate-800 p-1.5 text-indigo-400 hover:bg-indigo-600 hover:text-white"
              />
            </div>
          </div>
        ) : (
          /* Back of Card */
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg sm:text-xl font-bold text-white break-words">
                  {currentCard.word}
                </span>
                <span className="font-mono text-xs sm:text-sm text-indigo-300">
                  {currentCard.ipa}
                </span>
                <AudioSpeakButton
                  text={currentCard.word}
                  showLabel={false}
                  className="rounded-lg bg-slate-800 p-1.5 text-indigo-300 hover:bg-indigo-600 hover:text-white"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    stopAllSpeech();
                    setIsPronounceOpen(true);
                  }}
                  className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30"
                  title="Luyện nói từ này"
                >
                  <Mic className="h-3 w-3 shrink-0" />
                  <span>Chấm nói AI</span>
                </button>
              </div>
              <AudioSpeakButton
                text={currentCard.quoteFromBook}
                label="Đọc câu gốc"
                className="rounded-lg bg-slate-800 px-3 py-1 text-xs text-indigo-300 hover:bg-slate-700"
              />
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Nghĩa tiếng Việt trong ngữ cảnh:
              </div>
              <p className="mt-1 text-lg font-bold text-white">
                {currentCard.vietnameseMeaning}
              </p>
            </div>

            <div className="rounded-xl bg-slate-950/80 p-3.5 text-xs leading-relaxed text-slate-300">
              <strong className="text-indigo-300">Giải thích sâu: </strong>
              {currentCard.explanationInContext}
            </div>

            <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-3.5 text-xs">
              <p className="italic text-slate-200">
                &ldquo;{currentCard.quoteFromBook}&rdquo;
              </p>
              <p className="mt-1 text-slate-400">
                → {currentCard.quoteTranslation}
              </p>
            </div>

            {currentCard.collocations && currentCard.collocations.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {currentCard.collocations.map((col, idx) => (
                  <span
                    key={idx}
                    className="rounded-md bg-slate-800 px-2.5 py-1 text-[11px] text-slate-300"
                  >
                    {col}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Explicit Previous / Flip / Next Navigation Controls */}
      <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/[0.08] bg-[#0F1523]/90 p-2">
        <button
          type="button"
          onClick={handlePrev}
          className="flex min-h-[40px] items-center justify-center gap-1 rounded-xl border border-white/[0.08] bg-slate-950 px-2.5 sm:px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-indigo-500/50 hover:bg-slate-900"
        >
          <ChevronLeft className="h-4 w-4 text-indigo-400 shrink-0" />
          <span className="truncate">Từ trước</span>
        </button>

        <button
          type="button"
          onClick={() => setIsFlipped(!isFlipped)}
          className="flex min-h-[40px] items-center justify-center gap-1 rounded-xl bg-white/[0.07] px-2.5 sm:px-4 py-2 text-xs font-semibold text-indigo-300 hover:bg-white/[0.12]"
        >
          <RotateCw className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {isFlipped ? "Mặt trước" : "Lật nghĩa"}
          </span>
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="flex min-h-[40px] items-center justify-center gap-1 rounded-xl border border-white/[0.08] bg-slate-950 px-2.5 sm:px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-indigo-500/50 hover:bg-slate-900"
        >
          <span className="truncate">Tiếp theo</span>
          <ChevronRight className="h-4 w-4 text-indigo-400 shrink-0" />
        </button>
      </div>

      {/* SRS Rating Buttons */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <button
          type="button"
          onClick={() => handleGrade(0)}
          className="flex flex-col items-center rounded-xl border border-rose-500/30 bg-rose-950/30 py-2.5 text-rose-300 transition hover:bg-rose-900/50"
        >
          <span className="text-xs font-bold">Quên (Again)</span>
          <span className="text-[11px] text-rose-400/80">Ôn lại sau 10 phút</span>
        </button>
        <button
          type="button"
          onClick={() => handleGrade(3)}
          className="flex flex-col items-center rounded-xl border border-amber-500/30 bg-amber-950/30 py-2.5 text-amber-300 transition hover:bg-amber-900/50"
        >
          <span className="text-xs font-bold">Nhớ mang máng (Hard)</span>
          <span className="text-[11px] text-amber-400/80">Ôn sau 1 ngày</span>
        </button>
        <button
          type="button"
          onClick={() => handleGrade(4)}
          className="flex flex-col items-center rounded-xl border border-emerald-500/30 bg-emerald-950/30 py-2.5 text-emerald-300 transition hover:bg-emerald-900/50"
        >
          <span className="text-xs font-bold">Nhớ tốt (Good)</span>
          <span className="text-[11px] text-emerald-400/80">
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
          className="flex flex-col items-center rounded-xl border border-indigo-500/30 bg-indigo-950/30 py-2.5 text-indigo-300 transition hover:bg-indigo-900/50"
        >
          <span className="flex items-center gap-1 text-xs font-bold">
            <Sparkles className="h-3.5 w-3.5" />
            Thuộc làu (Easy)
          </span>
          <span className="text-[11px] text-indigo-400/80">
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
