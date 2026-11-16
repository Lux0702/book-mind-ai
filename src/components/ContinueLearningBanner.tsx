"use client";

import React, { useEffect, useState } from "react";
import { BookOpen, Play, Clock, ChevronRight, Sparkles } from "lucide-react";
import { Course } from "@/types/course";
import { getLastStudySession, LastStudySession } from "@/lib/storage";

interface ContinueLearningBannerProps {
  courses: Course[];
  onResumeSession: (session: LastStudySession) => void;
  className?: string;
}

const TAB_LABELS: Record<string, string> = {
  content: "Phân tích bài học",
  grammar: "Ngữ pháp chuyên sâu",
  vocabulary: "Từ vựng & Thuật ngữ",
  cloze: "Luyện điền từ (Cloze)",
  quiz: "Kiểm tra đọc hiểu",
  translation: "Tự dịch & AI Chấm",
  exam_arena: "Phòng thi 4 kỹ năng",
};

function formatRelativeTime(isoString: string): string {
  const ts = Date.parse(isoString);
  if (isNaN(ts)) return "Gần đây";
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return "Vừa học xong";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ngày trước`;
}

export default function ContinueLearningBanner({
  courses,
  onResumeSession,
  className = "",
}: ContinueLearningBannerProps) {
  const [session, setSession] = useState<LastStudySession | null>(null);

  useEffect(() => {
    const refreshSession = () => {
      setSession(getLastStudySession());
    };
    refreshSession();

    const handleSessionUpdated = () => refreshSession();
    window.addEventListener("bookmind:session-updated", handleSessionUpdated);
    window.addEventListener("storage", handleSessionUpdated);
    return () => {
      window.removeEventListener(
        "bookmind:session-updated",
        handleSessionUpdated
      );
      window.removeEventListener("storage", handleSessionUpdated);
    };
  }, [courses]);

  if (!session) return null;

  // Verify the course and chapter still exist in the user's current bookshelf
  const matchedCourse = courses.find((c) => c.id === session.courseId);
  if (!matchedCourse) return null;

  const matchedChapter = matchedCourse.chapters.find(
    (ch) => ch.id === session.chapterId
  );
  const displayTitle = matchedCourse.title || session.courseTitle;
  const displayChapterTitle =
    matchedChapter?.title || session.chapterTitle || `Chương ${session.chapterIndex + 1}`;
  const tabLabel = session.activeTab
    ? TAB_LABELS[session.activeTab] || "Bài học"
    : "Bài học";

  return (
    <div
      className={`bm-card-interactive relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-[#11182A] via-[#121B31] to-[#171C2E] p-4 sm:p-5 shadow-lg ${className}`}
    >
      {/* Subtle warm editorial corner highlight */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-indigo-500/10 blur-2xl" />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-500/15 text-indigo-300 shadow-inner">
            <BookOpen className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-indigo-400/25 bg-indigo-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                <Sparkles className="h-3 w-3" />
                Học tiếp vị trí đang dở
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                <Clock className="h-3 w-3 text-slate-400" />
                {formatRelativeTime(session.updatedAt)}
              </span>
            </div>

            <h3 className="truncate text-sm sm:text-base font-bold text-white">
              {displayTitle}
            </h3>

            <p className="truncate text-xs text-slate-300">
              <span className="font-semibold text-amber-300">
                {displayChapterTitle}
              </span>
              <span className="mx-1.5 text-slate-600">•</span>
              <span className="text-slate-400">Đang mở: {tabLabel}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onResumeSession(session)}
          className="inline-flex min-h-[44px] w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-indigo-950/50 transition hover:bg-indigo-500 active:scale-[0.98]"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>Học Tiếp Ngay</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
