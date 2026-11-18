"use client";

import React, { useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ROUTES, isLearningTab } from "@/lib/routes";
import ChapterWorkspace from "@/components/ChapterWorkspace";
import { useAppData } from "@/components/app/AppDataProvider";

/**
 * `/books/[courseId]`                          → mở sách (chương đầu, tab Nội dung)
 * `/books/[courseId]/[chapterId]/[tab]`        → mở đúng chương & tab
 *
 * Dùng optional catch-all để cả 2 dạng URL cùng 1 page → ChapterWorkspace
 * KHÔNG bị unmount khi đổi chương/tab (giữ nguyên state bài tập đang làm).
 */
export default function BookPage() {
  const router = useRouter();
  const params = useParams<{ courseId: string; rest?: string[] }>();
  const { courses, flashcards, refreshData, setIsSettingsOpen } = useAppData();

  const courseId = decodeURIComponent(String(params?.courseId || ""));
  const rest = Array.isArray(params?.rest) ? params.rest : [];
  const chapterIdFromUrl = rest[0] ? decodeURIComponent(rest[0]) : undefined;
  const tabFromUrl = rest[1] ? decodeURIComponent(rest[1]) : undefined;

  const course = courses.find((c) => c.id === courseId) || null;

  // Đồng bộ URL theo chương/tab người dùng đang chọn trong ChapterWorkspace
  const handleLocationChange = useCallback(
    (chapterId: string, tab: string) => {
      if (!course || !chapterId) return;
      const normalizedTab = isLearningTab(tab) ? tab : "content";
      if (chapterId === chapterIdFromUrl && normalizedTab === tabFromUrl) {
        return;
      }
      const url = ROUTES.chapter(course.id, chapterId, normalizedTab);
      // URL chưa có / sai chương hoặc tab (vừa vào sách, link cũ) → replace để nút Back không bị kẹt
      const urlIsValid =
        Boolean(chapterIdFromUrl) &&
        course.chapters.some((c) => c.id === chapterIdFromUrl) &&
        isLearningTab(tabFromUrl);
      if (!urlIsValid) {
        router.replace(url, { scroll: false });
      } else {
        router.push(url, { scroll: false });
      }
    },
    [course, chapterIdFromUrl, tabFromUrl, router]
  );

  if (!course) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
        <h1 className="text-lg font-bold text-white">Không tìm thấy cuốn sách này</h1>
        <p className="text-sm text-slate-400">
          Sách có thể đã bị xóa hoặc chưa có trong Tủ sách của tài khoản hiện tại.
        </p>
        <button
          type="button"
          onClick={() => router.push(ROUTES.books)}
          className="min-h-[44px] rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Về Tủ sách
        </button>
      </div>
    );
  }

  return (
    <div className="bm-view-enter flex-1 flex flex-col">
      <ChapterWorkspace
        course={course}
        flashcards={flashcards.filter((f) => f.courseId === course.id)}
        initialChapterId={chapterIdFromUrl}
        initialTab={tabFromUrl}
        onLocationChange={handleLocationChange}
        onBackToDashboard={() => router.push(ROUTES.books)}
        onCourseUpdated={async () => {
          await refreshData();
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
    </div>
  );
}
