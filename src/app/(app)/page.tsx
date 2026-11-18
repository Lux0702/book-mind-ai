"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import AttendanceDashboard from "@/components/AttendanceDashboard";
import ContinueLearningBanner from "@/components/ContinueLearningBanner";
import { useAppData } from "@/components/app/AppDataProvider";

/** `/` — Điểm danh & chuỗi ngày học */
export default function HomePage() {
  const router = useRouter();
  const { courses, flashcards } = useAppData();

  return (
    <div className="bm-view-enter flex-1 flex flex-col">
      <div className="mx-auto w-full max-w-5xl px-3.5 pt-5 sm:px-6 sm:pt-7">
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
