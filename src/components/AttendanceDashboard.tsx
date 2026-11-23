"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Flame,
  CheckCircle2,
  Clock,
  BookOpen,
  Award,
  Sparkles,
  GraduationCap,
  Layers,
  Languages,
  BarChart3,
  Trophy,
  Zap,
  Rocket,
  Cloud,
  RefreshCw,
  ArrowUpRight,
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
  syncAttendanceWithSupabase,
} from "@/lib/storage";
import { runWithFeedback } from "@/lib/feedback";
import { triggerChibiCelebrate } from "@/lib/chibiEvents";
import ChibiDailyQuestCard from "@/components/ChibiDailyQuestCard";

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
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [cloudSynced, setCloudSynced] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>("");
  const [showAllActivities, setShowAllActivities] = useState(false);

  const handleSyncCloud = useCallback(async (force = false) => {
    setIsSyncingCloud(true);
    try {
      const exec = async () => {
        const res = await syncAttendanceWithSupabase(force);
        setStreak(res.streak);
        setActivities(res.activities);
        setCloudSynced(res.syncedWithCloud);
        setLastSyncedTime(
          new Date().toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })
        );
      };
      if (force) {
        await runWithFeedback(
          {
            variant: "sync",
            loadingTitle: "Đang đồng bộ chuỗi Điểm danh với Supabase...",
            successTitle: "Đã đồng bộ dữ liệu Điểm danh!",
          },
          exec
        );
      } else {
        await exec();
      }
    } finally {
      setIsSyncingCloud(false);
    }
  }, []);

  useEffect(() => {
    setStreak(getStudyStreak());
    setActivities(getLearningActivities());
    void handleSyncCloud(false);

    const onAttendanceUpdated = (e: Event) => {
      const evt = e as CustomEvent<{
        streak?: StudyStreak;
        activities?: LearningActivity[];
      }>;
      setStreak(evt.detail?.streak || getStudyStreak());
      setActivities(evt.detail?.activities || getLearningActivities());
    };

    window.addEventListener("bookmind:attendance-updated", onAttendanceUpdated);
    return () => {
      window.removeEventListener(
        "bookmind:attendance-updated",
        onAttendanceUpdated
      );
    };
  }, [handleSyncCloud]);

  const todayStr = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })();

  const isCheckedInToday = streak.activeDates.includes(todayStr);

  const handleManualCheckIn = async () => {
    if (isCheckedInToday || isSyncingCloud) return;
    setIsSyncingCloud(true);
    try {
      const updated = await recordLearningActivity({
        type: "check_in",
        title: "Điểm danh hàng ngày",
        details: "Đã điểm danh duy trì chuỗi ngày học và đồng bộ lên Supabase Cloud.",
      });
      setStreak(updated);
      setActivities(getLearningActivities());
      setCloudSynced(true);
      setLastSyncedTime(
        new Date().toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
      setJustCheckedIn(true);
      setTimeout(() => setJustCheckedIn(false), 3000);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const last7Days = useMemoDays(7);

  // Statistics
  const totalCourses = courses.length;
  const totalChapters = courses.reduce(
    (acc, c) => acc + c.chapters.filter((ch) => ch.isGenerated).length,
    0
  );
  const totalVocab = flashcards.length;
  const masteredVocab = flashcards.filter((f) => f.interval >= 3).length;
  const dueVocab = flashcards.filter(
    (f) => new Date(f.nextReviewDate) <= new Date()
  ).length;
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
    <div className="mx-auto w-full max-w-5xl flex-1 px-3.5 py-5 sm:px-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* 1. TOP STREAK & ATTENDANCE STUDIO CARD */}
      <div className="relative rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-4 sm:p-7 shadow-[4px_4px_0_0_#F5EFE6]">
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#F5EFE6] bg-[#F3C969] px-3 py-1 text-[11px] font-extrabold tracking-wide text-[#141413] shadow-[2px_2px_0_0_#F5EFE6]">
                <Flame className="h-3.5 w-3.5" />
                <span>CHUỖI HỌC TẬP LIÊN TỤC</span>
              </div>

              <button
                type="button"
                onClick={() => void handleSyncCloud(true)}
                disabled={isSyncingCloud}
                title="Đồng bộ dữ liệu điểm danh 2 chiều với Supabase Cloud"
                className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#F5EFE6] bg-[#141413] px-3 py-1 text-[11px] font-bold text-[#F5EFE6] shadow-[2px_2px_0_0_#F5EFE6] transition-transform hover:bg-[#262520] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-60 cursor-pointer"
              >
                {isSyncingCloud ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin text-[#F3C969]" />
                    <span>Đang đồng bộ Supabase...</span>
                  </>
                ) : (
                  <>
                    <Cloud
                      className={`h-3 w-3 ${cloudSynced ? "text-[#A7D7A9]" : "text-[#B8B2A6]"
                        }`}
                    />
                    <span>
                      {cloudSynced
                        ? `Cloud đã đồng bộ${lastSyncedTime ? ` (${lastSyncedTime})` : ""}`
                        : "Đồng bộ Cloud"}
                    </span>
                    <RefreshCw className="h-2.5 w-2.5 text-[#B8B2A6]" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("bookmind:preview-chibi"))
                }
                title="Xem thử hoạt cảnh Pixel Chibi giận dữ khi bỏ lỡ điểm danh hôm qua"
                className="inline-flex items-center gap-1 rounded-full border-2 border-[#F5EFE6] bg-[#FF8A8A] px-2.5 py-1 text-[11px] font-extrabold text-[#141413] shadow-[2px_2px_0_0_#F5EFE6] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
              >
                <span>💢 Thử Chibi giận</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  triggerChibiCelebrate({
                    badge: "🎉 CHIBI KHEN NGỢI!",
                    message:
                      "WOOHOO!! Học xuất sắc quá trời ơi!! La la la~ Quẩy lên nào!! 🎵✨",
                    subtext: "Hoàn thành tốt bài học & bài thi!",
                  })
                }
                title="Xem thử hoạt cảnh Pixel Chibi nhảy nhót la hát khen ngợi"
                className="inline-flex items-center gap-1 rounded-full border-2 border-[#F5EFE6] bg-[#C8B6FF] px-2.5 py-1 text-[11px] font-extrabold text-[#141413] shadow-[2px_2px_0_0_#F5EFE6] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
              >
                <span>🎉 Thử Chibi khen</span>
              </button>
            </div>

            <div className="flex items-baseline gap-2.5 pt-1">
              <span className="text-4xl font-black tracking-tight text-[#F5EFE6] sm:text-6xl">
                {streak.currentStreak}
              </span>
              <span className="flex items-center gap-1.5 text-base sm:text-xl font-extrabold text-[#F3C969]">
                <span>ngày liên tiếp</span>
                <Flame className="h-4 w-4 sm:h-5 sm:w-5" />
              </span>
            </div>

            <p className="max-w-lg text-xs sm:text-sm text-[#B8B2A6] leading-relaxed">
              {isCheckedInToday
                ? "Bạn đã hoàn thành điểm danh hôm nay."
                : "Hôm nay bạn chưa điểm danh. Bấm nút điểm danh bên dưới hoặc hoàn thành một bài ôn tập để duy trì chuỗi ngày học!"}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end justify-between gap-3">
            <button
              type="button"
              disabled={isCheckedInToday || isSyncingCloud}
              onClick={handleManualCheckIn}
              className={`flex min-h-[46px] items-center justify-center gap-2 rounded-xl border-2 border-[#F5EFE6] px-5 py-3 text-xs sm:text-sm font-extrabold transition-transform ${isCheckedInToday
                  ? "bg-[#A7D7A9] text-[#141413] cursor-default"
                  : "bg-[#F3C969] text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] hover:bg-[#f7d683] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
                }`}
            >
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              <span>
                {isCheckedInToday
                  ? justCheckedIn
                    ? "Đã Điểm Danh & Đồng Bộ Cloud!"
                    : "Đã Điểm Danh Hôm Nay"
                  : "Điểm Danh Hôm Nay (+1 Ngày)"}
              </span>
            </button>

            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-x-4 gap-y-1 text-xs font-semibold text-[#B8B2A6]">
              <span>
                Kỷ lục:{" "}
                <strong className="font-extrabold text-[#F3C969]">
                  {streak.longestStreak} ngày
                </strong>
              </span>
              <span className="text-[#5A564D]">•</span>
              <span>
                Tổng tích lũy:{" "}
                <strong className="font-extrabold text-[#A7D7A9]">
                  {streak.activeDates.length} ngày
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* 7-Day Visual Calendar Tracker */}
        <div className="mt-6 border-t-2 border-[#3A3832] pt-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#B8B2A6]">
              Lịch sử 7 ngày gần nhất
            </span>
            <span className="text-[11px] font-semibold text-[#B8B2A6]">
              Hôm nay: <strong className="text-[#F5EFE6]">{todayStr}</strong>
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
            {last7Days.map((d, i) => {
              const active = streak.activeDates.includes(d.iso);
              const isToday = d.iso === todayStr;

              return (
                <div
                  key={i}
                  className={`flex flex-col items-center justify-center rounded-xl border-2 py-2 px-1 sm:p-3 text-center ${isToday
                      ? active
                        ? "border-[#F5EFE6] bg-[#F3C969] text-[#141413]"
                        : "border-[#F3C969] bg-[#141413] text-[#F3C969]"
                      : active
                        ? "border-[#A7D7A9] bg-[#141413] text-[#A7D7A9]"
                        : "border-[#3A3832] bg-[#141413] text-[#7A756A]"
                    }`}
                >
                  <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-tight">
                    {d.dayName}
                  </span>
                  <span className="mt-0.5 text-xs sm:text-base font-black">
                    {d.dayNumber}
                  </span>
                  <div className="mt-1 sm:mt-1.5">
                    {active ? (
                      <CheckCircle2
                        className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isToday ? "text-[#141413]" : "text-[#A7D7A9]"
                          }`}
                      />
                    ) : (
                      <div className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full border-2 border-[#3A3832] bg-[#1D1C19]" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 1.5 DAILY QUEST & PIXEL CHIBI EVOLUTION */}
      <ChibiDailyQuestCard
        streak={streak}
        activities={activities}
        courses={courses}
        flashcards={flashcards}
        onCheckIn={handleManualCheckIn}
        onOpenSrs={onOpenSrs}
        onOpenFirstCourse={() => {
          if (courses[0]) {
            onOpenCourse(courses[0].id);
          } else {
            onOpenSrs();
          }
        }}
      />

      {/* 2. STATS SUMMARY GRID */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#F5EFE6] bg-[#C8B6FF] text-[#141413] shadow-[2px_2px_0_0_#F5EFE6]">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#F5EFE6]">
                Tổng Quan Năng Lực Tích Lũy
              </h2>
              <p className="text-xs text-[#B8B2A6]">
                Thống kê tiến độ thực tế từ tủ sách và kho thẻ từ SRS của bạn
              </p>
            </div>
          </div>

          {dueVocab > 0 && (
            <button
              type="button"
              onClick={onOpenSrs}
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#B8D8F8] px-3.5 py-2 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
            >
              <span>Ôn ngay {dueVocab} từ đến hạn</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-4 sm:p-5 space-y-1.5 shadow-[4px_4px_0_0_#F5EFE6]">
            <div className="flex items-center justify-between text-xs font-bold text-[#B8B2A6]">
              <span>Từ Vựng Đã Lưu</span>
              <GraduationCap className="h-4 w-4 text-[#C8B6FF] shrink-0" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[#F5EFE6]">
              {totalVocab}{" "}
              <span className="text-xs font-semibold text-[#B8B2A6]">từ</span>
            </div>
            <p className="text-[11px] font-bold text-[#A7D7A9]">
              {masteredVocab} từ đã thuộc vững (SRS)
            </p>
          </div>

          <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-4 sm:p-5 space-y-1.5 shadow-[4px_4px_0_0_#F5EFE6]">
            <div className="flex items-center justify-between text-xs font-bold text-[#B8B2A6]">
              <span>Chương Đã Phân Tích</span>
              <Layers className="h-4 w-4 text-[#A7D7A9] shrink-0" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[#F5EFE6]">
              {totalChapters}{" "}
              <span className="text-xs font-semibold text-[#B8B2A6]">chương</span>
            </div>
            <p className="text-[11px] font-semibold text-[#B8B2A6]">
              Từ {totalCourses} cuốn sách trong tủ
            </p>
          </div>

          <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-4 sm:p-5 space-y-1.5 shadow-[4px_4px_0_0_#F5EFE6]">
            <div className="flex items-center justify-between text-xs font-bold text-[#B8B2A6]">
              <span>Bài Luyện Tập</span>
              <Languages className="h-4 w-4 text-[#B8D8F8] shrink-0" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[#F5EFE6]">
              {totalExercisesDone}{" "}
              <span className="text-xs font-semibold text-[#B8B2A6]">bài</span>
            </div>
            <p className="text-[11px] font-bold text-[#B8D8F8]">
              Quiz, điền từ Cloze &amp; luyện dịch
            </p>
          </div>

          <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-4 sm:p-5 space-y-1.5 shadow-[4px_4px_0_0_#F5EFE6]">
            <div className="flex items-center justify-between text-xs font-bold text-[#B8B2A6]">
              <span>Danh Hiệu Học Thuật</span>
              <Award className="h-4 w-4 text-[#F3C969] shrink-0" />
            </div>
            <div className="flex items-center gap-1.5 text-sm sm:text-base font-extrabold text-[#F3C969] pt-0.5">
              {streak.currentStreak >= 14 ? (
                <>
                  <Trophy className="h-4 w-4 shrink-0" />
                  <span className="truncate">Học Giả Kiên Định</span>
                </>
              ) : streak.currentStreak >= 7 ? (
                <>
                  <Zap className="h-4 w-4 shrink-0" />
                  <span className="truncate">Chiến Thần Đọc Sách</span>
                </>
              ) : streak.currentStreak >= 3 ? (
                <>
                  <Rocket className="h-4 w-4 shrink-0" />
                  <span className="truncate">Người Đọc Bền Bỉ</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span className="truncate">Khởi Đầu Tri Thức</span>
                </>
              )}
            </div>
            <p className="text-[11px] text-[#B8B2A6]">
              {courses[0] ? (
                <button
                  type="button"
                  onClick={() => onOpenCourse(courses[0].id)}
                  className="font-bold text-[#C8B6FF] hover:underline cursor-pointer"
                >
                  Đọc tiếp: {courses[0].title.slice(0, 22)}...
                </button>
              ) : (
                "Duy trì 7 ngày để thăng hạng"
              )}
            </p>
          </div>
        </div>
      </div>

      {/* 3. RECENT ACTIVITY TIMELINE */}
      <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-4 sm:p-6 space-y-4 shadow-[4px_4px_0_0_#F5EFE6]">
        <div className="flex items-center justify-between border-b-2 border-[#3A3832] pb-3.5">
          <div className="flex items-center gap-2 text-sm sm:text-base font-extrabold text-[#F5EFE6]">
            <Clock className="h-4 w-4 text-[#C8B6FF] shrink-0" />
            <span>Nhật Ký Hoạt Động Gần Đây</span>
          </div>
          <span className="rounded-full border-2 border-[#3A3832] bg-[#141413] px-2.5 py-0.5 text-xs font-bold text-[#B8B2A6]">
            {activities.length} sự kiện
          </span>
        </div>

        {activities.length === 0 ? (
          <div className="py-10 text-center text-xs sm:text-sm text-[#B8B2A6]">
            Chưa có hoạt động nào được ghi nhận. Hãy bấm Điểm danh hoặc học một chương sách!
          </div>
        ) : (
          <div className="space-y-2.5">
            {(showAllActivities ? activities : activities.slice(0, 6)).map(
              (act) => (
                <div
                  key={act.id}
                  className="flex items-start sm:items-center gap-3 rounded-xl border-2 border-[#3A3832] bg-[#141413] p-3 sm:p-3.5 text-xs"
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-[#F5EFE6] text-[#141413] ${act.type === "vocab_review"
                        ? "bg-[#C8B6FF]"
                        : act.type === "check_in"
                          ? "bg-[#F3C969]"
                          : "bg-[#A7D7A9]"
                      }`}
                  >
                    {act.type === "vocab_review" ? (
                      <Sparkles className="h-3.5 w-3.5" />
                    ) : act.type === "check_in" ? (
                      <Flame className="h-3.5 w-3.5" />
                    ) : (
                      <BookOpen className="h-3.5 w-3.5" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-bold text-[#F5EFE6] truncate">
                        {act.title}
                      </span>
                      <span className="text-[11px] font-semibold text-[#B8B2A6] shrink-0">
                        {formatTimeAgo(act.timestamp)}
                      </span>
                    </div>
                    <p className="text-[#B8B2A6] leading-relaxed break-words">
                      {act.details}
                    </p>
                  </div>
                </div>
              )
            )}
            {activities.length > 6 && (
              <button
                type="button"
                onClick={() => setShowAllActivities(!showAllActivities)}
                className="flex min-h-[42px] w-full items-center justify-center rounded-xl border-2 border-[#F5EFE6] bg-[#141413] px-4 py-2 text-xs font-extrabold text-[#F5EFE6] shadow-[3px_3px_0_0_#F5EFE6] transition-transform hover:bg-[#262520] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
              >
                {showAllActivities
                  ? "Thu gọn"
                  : `Xem tất cả (${activities.length})`}
              </button>
            )}
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
