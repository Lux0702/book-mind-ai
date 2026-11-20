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
            className="flex items-center justify-between gap-3 rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] px-4 py-3 text-xs sm:text-sm shadow-[4px_4px_0_0_#F5EFE6] transition-transform hover:bg-[#25241F] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6]"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-[#F5EFE6] bg-[#F3C969] text-[#141413]">
                <GraduationCap className="h-4 w-4" />
              </div>
              <span className="truncate font-semibold text-[#F5EFE6]">
                Hôm nay bạn có{" "}
                <strong className="text-[#F3C969]">
                  {dueFlashcards.length} thẻ từ vựng
                </strong>{" "}
                đến hạn ôn tập SRS
              </span>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border-2 border-[#F5EFE6] bg-[#F3C969] px-3 py-1 text-xs font-bold text-[#141413] shadow-[2px_2px_0_0_#F5EFE6]">
              <span>Ôn ngay</span>
              <ChevronRight className="h-3.5 w-3.5" />
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
