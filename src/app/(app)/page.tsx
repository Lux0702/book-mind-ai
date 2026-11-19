"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, ChevronRight } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import AttendanceDashboard from "@/components/AttendanceDashboard";
import ContinueLearningBanner from "@/components/ContinueLearningBanner";
import { useAppData } from "@/components/app/AppDataProvider";

/** `/` — Điểm danh & chuỗi ngày học */
export default function HomePage() {
  const router = useRouter();
  const { courses, flashcards, dueFlashcards } = useAppData();

  return (
    <div className="bm-view-enter flex-1 flex flex-col">
      <div className="mx-auto w-full max-w-5xl px-3.5 pt-5 sm:px-6 sm:pt-7 space-y-3">
        <ContinueLearningBanner
          courses={courses}
          onResumeSession={(session) =>
            router.push(
              ROUTES.chapter(
                session.courseId,
                session.chapterId,
                session.activeTab
              )
            )
          }
        />

        {dueFlashcards.length > 0 && (
          <Link
            href={`${ROUTES.srs}?mode=flashcards`}
            className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3 text-xs sm:text-sm transition hover:border-amber-400/50 hover:bg-amber-500/[0.12]"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
                <GraduationCap className="h-4 w-4" />
              </div>
              <span className="truncate text-slate-200">
                Hôm nay bạn có{" "}
                <strong className="text-amber-300">
                  {dueFlashcards.length} thẻ từ vựng
                </strong>{" "}
                đến hạn ôn tập SRS
              </span>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 font-bold text-amber-300">
              <span>Ôn ngay</span>
              <ChevronRight className="h-4 w-4" />
            </span>
          </Link>
        )}
      </div>

      <AttendanceDashboard
        courses={courses}
        flashcards={flashcards}
        onOpenCourse={(courseId) => router.push(ROUTES.book(courseId))}
        onOpenSrs={() => router.push(ROUTES.srs)}
      />
    </div>
  );
}
