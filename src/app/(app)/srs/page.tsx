"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Layers, Sparkles, Timer, GraduationCap, FileUp } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import CustomSelect from "@/components/ui/CustomSelect";
import ExamArena from "@/components/ExamArena";
import FlashcardArena from "@/components/FlashcardArena";
import { useAppData } from "@/components/app/AppDataProvider";

function SrsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { courses, flashcards, refreshData } = useAppData();

  const courseParam = searchParams.get("course") || "";
  const chapterParam = searchParams.get("chapter") || "";
  const modeParam = searchParams.get("mode");

  const targetCourse =
    courses.find((c) => c.id === courseParam) || courses[0];
  const targetChapter =
    targetCourse?.chapters.find((ch) => ch.id === chapterParam) ||
    targetCourse?.chapters[0];
  const reviewSubTab: "exam" | "flashcards" =
    modeParam === "flashcards" ? "flashcards" : "exam";

  const updateSrsQuery = (next: {
    course?: string;
    chapter?: string;
    mode?: "exam" | "flashcards";
  }) => {
    const params = new URLSearchParams();
    const cId = next.course ?? targetCourse?.id ?? "";
    const chId = next.chapter ?? targetChapter?.id ?? "";
    const mode = next.mode ?? reviewSubTab;
    if (cId) params.set("course", cId);
    if (chId) params.set("chapter", chId);
    if (mode) params.set("mode", mode);
    router.replace(`${ROUTES.srs}?${params.toString()}`, { scroll: false });
  };

  const scopedFlashcards = flashcards.filter(
    (f) =>
      f.courseId === targetCourse?.id &&
      (!targetChapter || f.chapterId === targetChapter.id)
  );

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 space-y-5">
      {/* Unified 3-Mode Switcher at the very top: 1. Theo Sách/Chương vs 2. Theo Chủ đề Từ vựng vs 3. Đề Thi Động Từ File */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-3.5 shadow-[4px_4px_0_0_#F5EFE6]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 flex-1">
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-3.5 py-2.5 text-xs sm:text-sm font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] cursor-pointer"
          >
            <BookOpen className="h-4 w-4 shrink-0" />
            <span className="truncate">1. Ôn &amp; Thi Theo Sách</span>
          </button>

          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("bookmind:route-start"));
              router.push(ROUTES.topicVocab);
            }}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-[#3A3832] bg-[#141413] px-3.5 py-2.5 text-xs sm:text-sm font-extrabold text-[#F5EFE6] hover:border-[#F5EFE6] transition-colors cursor-pointer"
          >
            <Sparkles className="h-4 w-4 text-[#C8B6FF] shrink-0" />
            <span className="truncate">2. Từ Vựng Chủ Đề</span>
          </button>

          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("bookmind:route-start"));
              router.push(ROUTES.dynamicExam);
            }}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-[#3A3832] bg-[#141413] px-3.5 py-2.5 text-xs sm:text-sm font-extrabold text-[#F5EFE6] hover:border-[#F5EFE6] transition-colors cursor-pointer"
          >
            <FileUp className="h-4 w-4 text-[#A7D7A9] shrink-0" />
            <span className="truncate">3. Đề Thi Động Từ File (AI)</span>
          </button>
        </div>
      </div>

      {/* Filter by Course -> Chapter */}
      {targetCourse && (
        <div className="grid grid-cols-1 gap-4 rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-5 shadow-[4px_4px_0_0_#F5EFE6] md:grid-cols-3 md:items-end">
          <div className="min-w-0">
            <label className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#C8B6FF] whitespace-nowrap truncate">
              <BookOpen className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">1. Chọn Khóa Học</span>
            </label>
            <CustomSelect
              value={targetCourse.id}
              onChange={(newVal) => {
                const newC = courses.find((c) => c.id === newVal);
                updateSrsQuery({
                  course: newVal,
                  chapter: newC?.chapters[0]?.id || "",
                });
              }}
              accentColor="indigo"
              icon={<BookOpen className="h-3.5 w-3.5" />}
              options={courses.map((c) => ({
                value: c.id,
                label: c.title,
                subLabel: `${c.chapters.length} chương • CEFR ${c.level}`,
                badge: `${c.chapters.length} ch`,
              }))}
            />
          </div>

          <div className="min-w-0">
            <label className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#A7D7A9] whitespace-nowrap truncate">
              <Layers className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">2. Chọn Chương Ôn Tập</span>
            </label>
            <CustomSelect
              value={targetChapter?.id || ""}
              onChange={(newVal) => updateSrsQuery({ chapter: newVal })}
              accentColor="emerald"
              icon={<Layers className="h-3.5 w-3.5" />}
              options={targetCourse.chapters.map((ch) => ({
                value: ch.id,
                label: `Chương ${ch.index}: ${ch.title}`,
                subLabel:
                  ch.startPage && ch.endPage
                    ? `Trang ${ch.startPage}–${ch.endPage}`
                    : undefined,
                badge: ch.isGenerated ? "Đã soạn" : "Chưa soạn",
              }))}
            />
          </div>

          <div className="min-w-0">
            <label className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#F3C969] whitespace-nowrap truncate">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">3. Chế Độ</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => updateSrsQuery({ mode: "exam" })}
                className={`flex h-[54px] items-center justify-center gap-1.5 rounded-lg border-2 px-3 text-xs font-extrabold transition-transform active:translate-x-[2px] active:translate-y-[2px] cursor-pointer ${
                  reviewSubTab === "exam"
                    ? "border-[#F5EFE6] bg-[#F3C969] text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] active:shadow-[1px_1px_0_0_#F5EFE6]"
                    : "border-[#3A3832] bg-[#141413] text-[#B8B2A6] hover:border-[#F5EFE6] hover:text-[#F5EFE6]"
                }`}
              >
                <Timer className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Thi Kiểm Tra</span>
              </button>
              <button
                type="button"
                onClick={() => updateSrsQuery({ mode: "flashcards" })}
                className={`flex h-[54px] items-center justify-center gap-1.5 rounded-lg border-2 px-3 text-xs font-extrabold transition-transform active:translate-x-[2px] active:translate-y-[2px] cursor-pointer ${
                  reviewSubTab === "flashcards"
                    ? "border-[#F5EFE6] bg-[#C8B6FF] text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] active:shadow-[1px_1px_0_0_#F5EFE6]"
                    : "border-[#3A3832] bg-[#141413] text-[#B8B2A6] hover:border-[#F5EFE6] hover:text-[#F5EFE6]"
                }`}
              >
                <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  Flashcard ({scopedFlashcards.length})
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {targetCourse && targetChapter && reviewSubTab === "exam" ? (
        <ExamArena
          course={targetCourse}
          currentChapter={targetChapter}
          courseFlashcards={flashcards.filter(
            (f) => f.courseId === targetCourse.id
          )}
        />
      ) : (
        <FlashcardArena
          cards={scopedFlashcards}
          onCardsUpdated={refreshData}
        />
      )}
    </div>
  );
}

export default function SrsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 text-center text-sm text-slate-400">
          Đang tải phòng ôn tập...
        </div>
      }
    >
      <SrsPageContent />
    </Suspense>
  );
}
