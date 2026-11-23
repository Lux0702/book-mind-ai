"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Loader2,
  Camera,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Star,
  Square,
  Play,
  Mic,
  Link2,
  MessageSquare,
} from "lucide-react";
import {
  Course,
  ChapterUnit,
  ChapterLesson,
  FlashcardSRS,
} from "@/types/course";
import {
  saveCoursePdfBlob,
  getStarredVocabIds,
  toggleStarredVocabId,
  normalizeStarVocabKey,
} from "@/lib/storage";
import { convertUploadedFilesToImagesBase64 } from "@/lib/pdfParser";
import { speakSmart, stopAllSpeech } from "@/lib/tts";
import AudioSpeakButton from "@/components/AudioSpeakButton";
import FlashcardArena from "@/components/FlashcardArena";
import VocabScanningLoader from "@/components/loadings/VocabScanningLoader";
import { PronunciationTargetParams } from "./types";

interface VocabularyTabProps {
  course: Course;
  currentChapter: ChapterUnit;
  lesson: ChapterLesson;
  chapterFlashcards: FlashcardSRS[];
  isExtractingFullVocab: boolean;
  onSetIsExtractingFullVocab: (loading: boolean) => void;
  onExtractFullVocab: (
    chapter: ChapterUnit,
    images?: string[]
  ) => Promise<void>;
  onCourseUpdated: (updated: Course) => Promise<void>;
  onHasCachedPdf: () => void;
  onOpenPronunciation: (params: PronunciationTargetParams) => void;
}

export default function VocabularyTab({
  course,
  currentChapter,
  lesson,
  chapterFlashcards,
  isExtractingFullVocab,
  onSetIsExtractingFullVocab,
  onExtractFullVocab,
  onCourseUpdated,
  onHasCachedPdf,
  onOpenPronunciation,
}: VocabularyTabProps) {
  const [mobileVocabLayout, setMobileVocabLayout] = useState<
    "carousel" | "list"
  >("carousel");
  const [vocabSearchQuery, setVocabSearchQuery] = useState("");
  const [vocabStarFilter, setVocabStarFilter] = useState<"all" | "starred">(
    "all"
  );
  const [starredVocabKeys, setStarredVocabKeys] = useState<string[]>([]);
  const [autoPlayVocabId, setAutoPlayVocabId] = useState<string | null>(null);
  const autoPlayCancelRef = useRef<boolean>(false);

  // Sync starred hard vocabulary across Tab 3 & FlashcardArena
  useEffect(() => {
    const syncStarred = () => setStarredVocabKeys(getStarredVocabIds());
    syncStarred();
    window.addEventListener("bookmind:starred-updated", syncStarred);
    return () => {
      window.removeEventListener("bookmind:starred-updated", syncStarred);
    };
  }, []);

  // Stop auto-play if chapter changes or component unmounts
  useEffect(() => {
    autoPlayCancelRef.current = true;
    setAutoPlayVocabId(null);
    return () => {
      autoPlayCancelRef.current = true;
      stopAllSpeech();
    };
  }, [currentChapter.id]);

  const handleToggleStarVocab = (word: string) => {
    const res = toggleStarredVocabId(word);
    setStarredVocabKeys(res.starredIds);
  };

  const stopAutoPlayVocab = () => {
    autoPlayCancelRef.current = true;
    setAutoPlayVocabId(null);
    stopAllSpeech();
  };

  const handleToggleAutoPlayVocab = async (
    items: Array<{ id: string; word: string }>
  ) => {
    if (autoPlayVocabId !== null) {
      stopAutoPlayVocab();
      return;
    }
    if (!items || items.length === 0) return;

    autoPlayCancelRef.current = false;

    const speakWait = (text: string) =>
      new Promise<void>((resolve) => {
        let settled = false;
        let sawStart = false;
        const done = () => {
          if (settled) return;
          settled = true;
          window.removeEventListener(
            "bookmind-tts-status",
            onStatus as EventListener
          );
          clearTimeout(timer);
          resolve();
        };
        const onStatus = (e: Event) => {
          const detail = (e as CustomEvent<{ isPlaying?: boolean }>).detail;
          if (detail?.isPlaying) {
            sawStart = true;
          } else if (sawStart) {
            done();
          }
        };
        const timer = setTimeout(done, 4800);
        window.addEventListener(
          "bookmind-tts-status",
          onStatus as EventListener
        );
        speakSmart(text);
      });

    for (const item of items) {
      if (autoPlayCancelRef.current) break;
      setAutoPlayVocabId(item.id);
      if (typeof document !== "undefined") {
        document.getElementById(`vocab-card-${item.id}`)?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
      await speakWait(item.word);
      if (autoPlayCancelRef.current) break;
      await new Promise((r) => setTimeout(r, 380));
    }

    autoPlayCancelRef.current = true;
    setAutoPlayVocabId(null);
  };

  const q = vocabSearchQuery.trim().toLowerCase();
  const starredInChapterCount = lesson.vocabulary.filter((v) =>
    starredVocabKeys.includes(normalizeStarVocabKey(v.word))
  ).length;

  const filteredVocab = lesson.vocabulary.filter((v) => {
    const isStarred = starredVocabKeys.includes(normalizeStarVocabKey(v.word));
    if (vocabStarFilter === "starred" && !isStarred) {
      return false;
    }
    if (!q) return true;
    return (
      v.word.toLowerCase().includes(q) ||
      v.vietnameseMeaning.toLowerCase().includes(q) ||
      (v.ipa || "").toLowerCase().includes(q) ||
      (v.explanationInContext || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Interactive SRS Flashcard Deck */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm sm:text-base font-extrabold text-[#F5EFE6]">
          <Sparkles className="h-4 w-4 text-[#F3C969] shrink-0" />
          <span>
            Luyện lật thẻ nhớ từ vựng thông minh (Spaced Repetition SRS)
          </span>
        </h3>
        <FlashcardArena
          cards={chapterFlashcards}
          onCardsUpdated={() => onCourseUpdated(course)}
        />
      </div>

      {/* Detailed Vocabulary Table / Cards */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-4 shadow-[4px_4px_0_0_#F5EFE6]">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-[#F5EFE6]">
              Bảng phân tích toàn bộ Từ vựng, Danh từ riêng &amp; Cụm từ (
              {lesson.vocabulary.length} từ)
            </h3>
            <p className="text-xs text-[#B8B2A6] mt-0.5">
              {currentChapter.rawText.length > 16000 &&
              lesson.vocabulary.length < 35
                ? `Chương dài (${currentChapter.rawText.length.toLocaleString()} ký tự) — bấm "Quét Đủ 100% Từ Vựng" để AI rà soát hết các phần còn lại!`
                : "Nếu chương sách có nhiều từ vựng hơn (VD: 35–50 từ), bấm nút bên phải để AI quét lấy đủ 100% không sót từ nào!"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Chuyển chế độ lướt ngang / danh sách trên điện thoại */}
            <div className="flex md:hidden items-center gap-1">
              <button
                type="button"
                onClick={() => setMobileVocabLayout("carousel")}
                className={`rounded-xl border-2 px-2.5 py-1.5 text-[11px] font-bold cursor-pointer ${
                  mobileVocabLayout === "carousel"
                    ? "border-[#F5EFE6] bg-[#F3C969] text-[#141413] shadow-[2px_2px_0_0_#F5EFE6]"
                    : "border-[#3A3832] bg-[#141413] text-[#B8B2A6]"
                }`}
              >
                Lướt ngang
              </button>
              <button
                type="button"
                onClick={() => setMobileVocabLayout("list")}
                className={`rounded-xl border-2 px-2.5 py-1.5 text-[11px] font-bold cursor-pointer ${
                  mobileVocabLayout === "list"
                    ? "border-[#F5EFE6] bg-[#F3C969] text-[#141413] shadow-[2px_2px_0_0_#F5EFE6]"
                    : "border-[#3A3832] bg-[#141413] text-[#B8B2A6]"
                }`}
              >
                Dạng danh sách
              </button>
            </div>

            <button
              type="button"
              disabled={isExtractingFullVocab}
              onClick={() => onExtractFullVocab(currentChapter)}
              className="flex items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-3.5 sm:px-4 py-2 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] disabled:opacity-50 cursor-pointer"
            >
              {isExtractingFullVocab ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI đang quét đủ 100% từ vựng...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Quét Đủ 100% Từ Vựng Trong Chương
                </>
              )}
            </button>

            <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#B8D8F8] px-3.5 py-2 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6]">
              <Camera className="h-3.5 w-3.5 shrink-0" />
              <span>Quét từ Ảnh / PDF (Tất cả trang)</span>
              <input
                type="file"
                accept=".pdf,image/png,image/jpeg,image/webp"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const files = e.target.files;
                  if (!files || files.length === 0) return;
                  onSetIsExtractingFullVocab(true);
                  try {
                    const firstPdf = Array.from(files).find(
                      (f) =>
                        f.type === "application/pdf" ||
                        f.name.toLowerCase().endsWith(".pdf")
                    );
                    if (firstPdf) {
                      await saveCoursePdfBlob(
                        course.id,
                        firstPdf,
                        firstPdf.name
                      );
                      onHasCachedPdf();
                    }
                    const imgs = await convertUploadedFilesToImagesBase64(
                      files,
                      currentChapter.startPage,
                      currentChapter.endPage,
                      20
                    );
                    await onExtractFullVocab(currentChapter, imgs);
                  } catch {
                    onSetIsExtractingFullVocab(false);
                  }
                }}
              />
            </label>
          </div>
        </div>

        {/* Unique Vocab Scanning Loader */}
        {isExtractingFullVocab && (
          <div className="mb-6">
            <VocabScanningLoader />
          </div>
        )}

        {/* Mobile Swipe Hint */}
        {mobileVocabLayout === "carousel" && lesson.vocabulary.length > 1 && (
          <div className="flex md:hidden items-center justify-center gap-1.5 text-[11px] font-bold text-[#F3C969]">
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>
              Lướt ngang qua lại để xem {lesson.vocabulary.length} từ vựng
            </span>
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
        )}

        {/* Search + Star Hard-Word Filter + Sequential Audio Auto-Play Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-3 shadow-[4px_4px_0_0_#F5EFE6]">
          <div className="relative flex-1 min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B8B2A6]" />
            <input
              type="text"
              value={vocabSearchQuery}
              onChange={(e) => setVocabSearchQuery(e.target.value)}
              placeholder="Tìm nhanh từ vựng, IPA hoặc nghĩa tiếng Việt..."
              className="min-h-[42px] w-full rounded-lg border-2 border-[#F5EFE6] bg-[#141413] pl-9 pr-9 py-2 text-xs sm:text-sm text-[#F5EFE6] placeholder-[#8F8A7E] focus:border-[#F3C969] focus:shadow-[2px_2px_0_0_#F3C969] focus:outline-none"
            />
            {vocabSearchQuery && (
              <button
                type="button"
                onClick={() => setVocabSearchQuery("")}
                aria-label="Xóa tìm kiếm"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#B8B2A6] hover:bg-[#2A2823] hover:text-[#F5EFE6]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setVocabStarFilter("all")}
                className={`min-h-[38px] rounded-xl border-2 px-3 py-1 text-xs font-bold transition-transform active:translate-x-[1px] active:translate-y-[1px] cursor-pointer ${
                  vocabStarFilter === "all"
                    ? "border-[#F5EFE6] bg-[#F3C969] text-[#141413] shadow-[3px_3px_0_0_#F5EFE6]"
                    : "border-[#3A3832] bg-[#141413] text-[#B8B2A6] hover:border-[#F5EFE6] hover:text-[#F5EFE6]"
                }`}
              >
                Tất cả ({lesson.vocabulary.length})
              </button>
              <button
                type="button"
                onClick={() => setVocabStarFilter("starred")}
                className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border-2 px-3 py-1 text-xs font-bold transition-transform active:translate-x-[1px] active:translate-y-[1px] cursor-pointer ${
                  vocabStarFilter === "starred"
                    ? "border-[#F5EFE6] bg-[#F3C969] text-[#141413] shadow-[3px_3px_0_0_#F5EFE6]"
                    : "border-[#3A3832] bg-[#141413] text-[#B8B2A6] hover:border-[#F5EFE6] hover:text-[#F5EFE6]"
                }`}
              >
                <Star className="h-3.5 w-3.5 fill-current" />
                <span>Từ khó ({starredInChapterCount})</span>
              </button>
            </div>

            <button
              type="button"
              disabled={filteredVocab.length === 0 && autoPlayVocabId === null}
              onClick={() => handleToggleAutoPlayVocab(filteredVocab)}
              className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border-2 border-[#F5EFE6] px-3.5 py-2 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer disabled:opacity-40 ${
                autoPlayVocabId !== null ? "bg-[#FF8A8A]" : "bg-[#C8B6FF]"
              }`}
            >
              {autoPlayVocabId !== null ? (
                <>
                  <Square className="h-3.5 w-3.5 fill-current" />
                  <span>Dừng nghe tự động</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Nghe tự động ({filteredVocab.length} từ)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {filteredVocab.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[#3A3832] bg-[#1D1C19] p-8 text-center space-y-3">
            <p className="text-sm font-bold text-[#F5EFE6]">
              {vocabStarFilter === "starred" && starredInChapterCount === 0
                ? "Bạn chưa đánh dấu ⭐ Từ khó nào trong chương này."
                : "Không tìm thấy từ vựng phù hợp với bộ lọc hiện tại."}
            </p>
            <button
              type="button"
              onClick={() => {
                setVocabSearchQuery("");
                setVocabStarFilter("all");
              }}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#C8B6FF] px-4 py-2 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] cursor-pointer"
            >
              Xem lại toàn bộ từ vựng
            </button>
          </div>
        ) : (
          <div
            className={
              mobileVocabLayout === "carousel"
                ? "flex overflow-x-auto snap-x snap-mandatory gap-4 pb-3 no-scrollbar md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:pb-0"
                : "grid grid-cols-1 gap-4 md:grid-cols-2"
            }
          >
            {filteredVocab.map((voc, vocIdx) => {
              const isStarred = starredVocabKeys.includes(
                normalizeStarVocabKey(voc.word)
              );
              const isAutoPlaying = autoPlayVocabId === voc.id;

              return (
                <div
                  key={voc.id}
                  id={`vocab-card-${voc.id}`}
                  className={`select-text rounded-xl border-2 p-4 sm:p-5 space-y-3 bg-[#1D1C19] shadow-[4px_4px_0_0_#F5EFE6] ${
                    isAutoPlaying
                      ? "border-[#F3C969]"
                      : isStarred
                      ? "border-[#F3C969]"
                      : "border-[#F5EFE6]"
                  } ${
                    mobileVocabLayout === "carousel"
                      ? "w-[86vw] max-w-[340px] shrink-0 snap-center md:w-auto md:max-w-none"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-extrabold text-[#F5EFE6] break-words">
                          {voc.word}
                        </h4>
                        {isAutoPlaying && (
                          <span className="inline-flex items-center gap-1 rounded-full border-2 border-[#F5EFE6] bg-[#F3C969] px-2 py-0.5 text-[10px] font-extrabold text-[#141413] animate-pulse">
                            🔊 Đang đọc
                          </span>
                        )}
                        <AudioSpeakButton
                          text={voc.word}
                          showLabel={false}
                          className="rounded-lg border-2 border-[#F5EFE6] bg-[#B8D8F8] p-1.5 text-[#141413]"
                        />
                        <button
                          type="button"
                          onClick={() => handleToggleStarVocab(voc.word)}
                          title={
                            isStarred
                              ? "Bỏ đánh dấu Từ khó"
                              : "Đánh dấu ⭐ Từ khó để ôn tập riêng"
                          }
                          className={`inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-lg border-2 transition-transform active:translate-y-[1px] cursor-pointer ${
                            isStarred
                              ? "border-[#F5EFE6] bg-[#F3C969] text-[#141413]"
                              : "border-[#3A3832] bg-[#141413] text-[#B8B2A6] hover:border-[#F5EFE6]"
                          }`}
                        >
                          <Star
                            className={`h-3.5 w-3.5 ${
                              isStarred ? "fill-current" : ""
                            }`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onOpenPronunciation({
                              targetText: voc.word,
                              phonetic: voc.ipa,
                              vietnameseMeaning: voc.vietnameseMeaning,
                              contextHint: `Ví dụ: ${voc.quoteFromBook}`,
                            })
                          }
                          className="flex items-center gap-1 rounded-lg border-2 border-[#F5EFE6] bg-[#A7D7A9] px-2 py-1 text-[11px] font-extrabold text-[#141413] transition-transform active:translate-y-[1px] cursor-pointer"
                          title="Luyện đọc từ này để AI chấm điểm"
                        >
                          <Mic className="h-3 w-3" />
                          <span>Luyện nói</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            window.dispatchEvent(
                              new CustomEvent("bookmind:ask-ai-tutor", {
                                detail: {
                                  question: `Phân tích sâu từ vựng "${voc.word}" (${voc.ipa} - ${voc.vietnameseMeaning}) trong bài học này: cách dùng, cụm từ đi kèm (collocations), từ đồng/trái nghĩa, các từ dễ nhầm lẫn và ví dụ thực tế.`,
                                  excerpt: `${voc.word} (${voc.ipa}): ${voc.vietnameseMeaning}`,
                                  autoSend: true,
                                },
                              })
                            );
                          }}
                          className="flex items-center gap-1 rounded-lg border-2 border-[#F5EFE6] bg-[#C8B6FF] px-2 py-1 text-[11px] font-extrabold text-[#141413] transition-transform active:translate-y-[1px] cursor-pointer"
                          title="Hỏi Gia sư AI phân tích sâu từ vựng này"
                        >
                          <MessageSquare className="h-3 w-3" />
                          <span>Hỏi AI</span>
                        </button>
                      </div>
                      <span className="font-mono text-xs font-semibold text-[#C8B6FF]">
                        {voc.ipa} • {voc.partOfSpeech}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="rounded-full border-2 border-[#3A3832] bg-[#141413] px-2 py-0.5 text-[10px] font-bold text-[#B8B2A6]">
                        Từ {vocIdx + 1}/{filteredVocab.length}
                      </span>
                      <span className="rounded-full border-2 border-[#F5EFE6] bg-[#C8B6FF] px-2.5 py-0.5 text-xs font-extrabold text-[#141413] shadow-[2px_2px_0_0_#F5EFE6]">
                        {voc.cefrLevel}
                      </span>
                    </div>
                  </div>

                  <div className="text-sm font-extrabold text-[#A7D7A9]">
                    {voc.vietnameseMeaning}
                  </div>

                  <p className="text-xs leading-relaxed text-[#F5EFE6]">
                    {voc.explanationInContext}
                  </p>

                  <div className="rounded-xl border-2 border-[#3A3832] bg-[#141413] p-3 text-xs">
                    <p className="italic text-[#F5EFE6]">
                      &ldquo;{voc.quoteFromBook}&rdquo;
                    </p>
                    <p className="mt-1 text-[#B8B2A6]">
                      → {voc.quoteTranslation}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {voc.collocations.map((c, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded-lg border-2 border-[#3A3832] bg-[#141413] px-2 py-0.5 text-[11px] font-semibold text-[#F5EFE6]"
                      >
                        <Link2 className="h-3 w-3 text-[#B8D8F8]" />
                        <span>{c}</span>
                      </span>
                    ))}
                    {voc.synonyms.map((s, idx) => (
                      <span
                        key={idx}
                        className="rounded-lg border-2 border-[#3A3832] bg-[#141413] px-2 py-0.5 text-[11px] font-bold text-[#C8B6FF]"
                      >
                        ≈ {s}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
