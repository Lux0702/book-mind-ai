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
          <h1 className="text-2xl font-bold text-white">
            Trung Tâm Kiểm Tra &amp; Ôn Tập Theo Khóa Học / Chương
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Chọn đúng Khóa học và Chương bạn muốn làm bài thi kiểm tra (có tính giờ từng câu) hoặc ôn Flashcard SRS.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push(ROUTES.books)}
          className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
        >
          Quay về Tủ sách
        </button>
      </div>

      {/* Filter by Course -> Chapter */}
      {targetCourse && (
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 md:grid-cols-3">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-300">
              <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
              <span>1. Chọn Khóa Học (Course)</span>
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

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-300">
              <Layers className="h-3.5 w-3.5 text-emerald-400" />
              <span>2. Chọn Chương Cần Kiểm Tra / Ôn Tập</span>
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

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>3. Chế độ</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => updateSrsQuery({ mode: "exam" })}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-3 text-xs font-bold transition cursor-pointer ${
                  reviewSubTab === "exam"
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-600/20"
                    : "border border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-900 hover:text-white"
                }`}
              >
                <Timer className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Thi Kiểm Tra</span>
              </button>
              <button
                type="button"
                onClick={() => updateSrsQuery({ mode: "flashcards" })}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-3 text-xs font-bold transition cursor-pointer ${
                  reviewSubTab === "flashcards"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                    : "border border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-900 hover:text-white"
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
