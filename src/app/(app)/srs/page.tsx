"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Layers, Sparkles, Timer, GraduationCap } from "lucide-react";
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
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#F5EFE6]">
            Trung Tâm Kiểm Tra &amp; Ôn Tập Theo Khóa Học / Chương
          </h1>
          <p className="mt-1 text-sm text-[#B8B2A6]">
            Chọn đúng Khóa học và Chương bạn muốn làm bài thi kiểm tra (có tính giờ từng câu) hoặc ôn Flashcard SRS.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push(ROUTES.books)}
          className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] px-4 py-2 text-xs font-bold text-[#F5EFE6] shadow-[3px_3px_0_0_#F5EFE6] transition-transform hover:bg-[#262520] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
        >
          Quay về Tủ sách
        </button>
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
