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
      className={`relative rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-4 sm:p-5 shadow-[4px_4px_0_0_#F5EFE6] ${className}`}
    >
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[#F5EFE6] bg-[#C8B6FF] text-[#141413]">
            <BookOpen className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border-2 border-[#F5EFE6] bg-[#F3C969] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#141413] shadow-[2px_2px_0_0_#F5EFE6]">
                <Sparkles className="h-3 w-3" />
                Học tiếp vị trí đang dở
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#B8B2A6]">
                <Clock className="h-3 w-3 text-[#B8B2A6]" />
                {formatRelativeTime(session.updatedAt)}
              </span>
            </div>

            <h3 className="truncate text-sm sm:text-base font-extrabold text-[#F5EFE6]">
              {displayTitle}
            </h3>

            <p className="truncate text-xs text-[#B8B2A6]">
              <span className="font-bold text-[#F3C969]">
                {displayChapterTitle}
              </span>
              <span className="mx-1.5 text-[#5A564D]">•</span>
              <span>Đang mở: {tabLabel}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onResumeSession(session)}
          className="inline-flex min-h-[44px] w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-5 py-2.5 text-xs sm:text-sm font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform hover:bg-[#b8e2ba] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>Học Tiếp Ngay</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
