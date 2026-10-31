"use client";

import React, { useState, useEffect } from "react";
import {
  Flame,
  Calendar,
  CheckCircle2,
  Clock,
  BookOpen,
  Award,
  Sparkles,
  ArrowRight,
  GraduationCap,
  Layers,
  Languages,
} from "lucide-react";
import {
  Course,
  FlashcardSRS,
  StudyStreak,
  LearningActivity,
} from "@/types/course";
import {
  getStudyStreak,
  getLearningActivities,
  recordLearningActivity,
} from "@/lib/storage";

interface AttendanceDashboardProps {
  courses: Course[];
  flashcards: FlashcardSRS[];
  onOpenCourse: (courseId: string) => void;
  onOpenSrs: () => void;
}

export default function AttendanceDashboard({
  courses,
  flashcards,
  onOpenCourse,
  onOpenSrs,
}: AttendanceDashboardProps) {
  const [streak, setStreak] = useState<StudyStreak>(getStudyStreak());
  const [activities, setActivities] = useState<LearningActivity[]>(
    getLearningActivities()
  );
  const [justCheckedIn, setJustCheckedIn] = useState(false);

  useEffect(() => {
    setStreak(getStudyStreak());
    setActivities(getLearningActivities());
  }, []);

  const todayStr = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })();

  const isCheckedInToday = streak.activeDates.includes(todayStr);

  const handleManualCheckIn = async () => {
    if (isCheckedInToday) return;
    const updated = await recordLearningActivity({
      type: "check_in",
      title: "Điểm danh hàng ngày",
      details: "Đã điểm danh duy trì chuỗi ngày học thành công!",
    });
    setStreak(updated);
    setActivities(getLearningActivities());
    setJustCheckedIn(true);
    setTimeout(() => setJustCheckedIn(false), 3000);
  };

  // 7-day visual week calendar (Mon-Sun ending today or last 7 days)
  const last7Days = useMemoDays(7);

  // Statistics
  const totalCourses = courses.length;
  const totalChapters = courses.reduce(
    (acc, c) => acc + c.chapters.filter((ch) => ch.isGenerated).length,
    0
  );
  const totalVocab = flashcards.length;
  const masteredVocab = flashcards.filter((f) => f.interval >= 3).length;
  const totalExercisesDone = courses.reduce(
    (sum, c) =>
      sum +
      c.chapters.reduce(
        (chSum, ch) =>
          chSum +
          ch.completedClozeIds.length +
          ch.completedQuizIds.length +
          ch.completedTranslationIds.length,
        0
      ),
    0
  );

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 space-y-8">
      {/* 1. TOP STREAK & ATTENDANCE HERO BANNER */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-extrabold text-amber-400">
              <Flame className="h-4 w-4 animate-bounce text-amber-400" />
              <span>CHUỖI HỌC TẬP MỖI NGÀY</span>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-black text-white sm:text-6xl">
                {streak.currentStreak}
              </span>
              <span className="text-xl font-bold text-amber-300">
                ngày liên tục 🔥
              </span>
            </div>

            <p className="max-w-md text-xs text-slate-300 leading-relaxed">
              {isCheckedInToday
                ? "🎉 Tuyệt vời! Bạn đã hoàn thành điểm danh hôm nay. Hãy học thêm một bài hoặc ôn Flashcard để giữ vững phong độ nhé!"
                : "Hôm nay bạn chưa điểm danh. Hãy bấm nút điểm danh hoặc học một bài học bất kỳ để tiếp tục giữ chuỗi lửa!"}
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              disabled={isCheckedInToday}
              onClick={handleManualCheckIn}
              className={`flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-black shadow-xl transition ${
                isCheckedInToday
                  ? "bg-emerald-600/25 border border-emerald-500/40 text-emerald-300 cursor-default"
                  : "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-amber-600/30 hover:scale-105"
              }`}
            >
              <CheckCircle2 className="h-5 w-5" />
              <span>
                {isCheckedInToday
                  ? "Đã Điểm Danh Hôm Nay ✅"
                  : "Điểm Danh Hôm Nay (+1 Ngày)"}
              </span>
            </button>

            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span>
                Kỷ lục chuỗi dài nhất:{" "}
                <strong className="text-amber-300">
                  {streak.longestStreak} ngày
                </strong>
              </span>
              <span>•</span>
              <span>
                Tổng số ngày đã học:{" "}
                <strong className="text-emerald-300">
                  {streak.activeDates.length} ngày
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* 7-Day Visual Calendar Tracker */}
        <div className="mt-8 border-t border-slate-800/80 pt-6">
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
            Lịch sử học tập 7 ngày gần đây:
          </div>
          <div className="grid grid-cols-7 gap-2 sm:gap-3">
            {last7Days.map((d, i) => {
              const active = streak.activeDates.includes(d.iso);
              const isToday = d.iso === todayStr;

              return (
                <div
                  key={i}
                  className={`flex flex-col items-center justify-center rounded-2xl border p-2.5 sm:p-3 text-center transition ${
                    isToday
                      ? active
                        ? "border-amber-500 bg-amber-500/20 text-white shadow-lg"
                        : "border-amber-500/50 bg-slate-900 text-amber-300 ring-2 ring-amber-500/20"
                      : active
                      ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-300"
                      : "border-slate-800 bg-slate-950/60 text-slate-500"
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase">
                    {d.dayName}
                  </span>
                  <span className="mt-1 text-sm font-extrabold sm:text-base">
                    {d.dayNumber}
                  </span>
                  <div className="mt-1.5">
                    {active ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-slate-700 bg-slate-900" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. STATS "ĐÃ HỌC ĐƯỢC GÌ" (WHAT HAS BEEN LEARNED) */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white">
            📊 Tổng Kết: Bạn Đã Học Được Những Gì?
          </h2>
          <p className="text-xs text-slate-400">
            Báo cáo chi tiết khối lượng kiến thức đã tích lũy từ các cuốn sách của bạn
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Kho Từ Vựng Đã Học</span>
              <GraduationCap className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="text-3xl font-black text-white">
              {totalVocab} <span className="text-xs text-slate-400">từ</span>
            </div>
            <p className="text-[11px] text-emerald-400">
              🔥 Trong đó: {masteredVocab} từ đã thuộc vững (SRS)
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Chương Sách Hoàn Thành</span>
              <Layers className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-white">
              {totalChapters} <span className="text-xs text-slate-400">chương</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Trích xuất từ {totalCourses} cuốn sách đã đọc
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Bài Tập & Câu Dịch</span>
              <Languages className="h-4 w-4 text-sky-400" />
            </div>
            <div className="text-3xl font-black text-white">
              {totalExercisesDone} <span className="text-xs text-slate-400">bài</span>
            </div>
            <p className="text-[11px] text-sky-300">
              Đã làm trắc nghiệm, điền từ & luyện dịch
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Đẳng Cấp Tự Học</span>
              <Award className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-amber-300">
              {streak.currentStreak >= 14
                ? "Bậc Thầy Chăm Chỉ 🏆"
                : streak.currentStreak >= 7
                ? "Chiến Thần Đọc Sách ⚡"
                : streak.currentStreak >= 3
                ? "Người Bắt Đầu Vững Vàng 🚀"
                : "Mầm Mống Tri Thức 🌱"}
            </div>
            <p className="text-[11px] text-slate-400">
              Duy trì 7 ngày liên tục để mở khóa danh hiệu mới!
            </p>
          </div>
        </div>
      </div>

      {/* 3. RECENT ACTIVITY LOG / TIMELINE */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 text-base font-bold text-white">
            <Clock className="h-4 w-4 text-indigo-400" />
            <span>Dòng Thời Gian Hoạt Động (Nhật Ký Học Gần Đây)</span>
          </div>
          <span className="text-xs text-slate-400">
            {activities.length} hoạt động được ghi lại
          </span>
        </div>

        {activities.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500">
            Chưa có hoạt động nào được ghi lại. Hãy bắt đầu ôn thẻ Flashcard hoặc học một chương sách ngay!
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {activities.map((act) => (
              <div
                key={act.id}
                className="flex items-start gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3.5 text-xs transition hover:border-slate-700"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
                  {act.type === "vocab_review" ? (
                    <Sparkles className="h-3.5 w-3.5" />
                  ) : act.type === "check_in" ? (
                    <Flame className="h-3.5 w-3.5 text-amber-400" />
                  ) : (
                    <BookOpen className="h-3.5 w-3.5" />
                  )}
                </div>

                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{act.title}</span>
                    <span className="text-[11px] text-slate-500">
                      {formatTimeAgo(act.timestamp)}
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{act.details}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function useMemoDays(count: number) {
  const days = [];
  const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
    days.push({
      iso,
      dayName: dayNames[d.getDay()],
      dayNumber: d.getDate(),
    });
  }
  return days;
}

function formatTimeAgo(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "Vừa xong";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} ngày trước`;
  } catch {
    return "";
  }
}
