"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { applyLibraryCourseToUser, getLibraryCourses } from "@/lib/storage";
import { ROUTES } from "@/lib/routes";
import BookLibraryView from "@/components/BookLibraryView";
import { useAppData } from "@/components/app/AppDataProvider";

/** `/library` — Thư viện sách cộng đồng */
export default function LibraryPage() {
  const router = useRouter();
  const {
    libraryCourses,
    setLibraryCourses,
    courses,
    currentUser,
    refreshData,
    setIsCreateOpen,
    handleDeleteCourse,
  } = useAppData();

  return (
    <BookLibraryView
      libraryCourses={libraryCourses}
      myCourses={courses}
      currentUser={currentUser}
      onApplyCourse={async (libCourse) => {
        const added = await applyLibraryCourseToUser(libCourse);
        await refreshData();
        return added;
      }}
      onOpenMyCourse={(courseId) => router.push(ROUTES.book(courseId))}
      onRefreshLibrary={async () => {
        const freshLib = await getLibraryCourses(true);
        setLibraryCourses(freshLib);
      }}
      onOpenCreateModal={() => setIsCreateOpen(true)}
      onDeleteLibraryCourse={handleDeleteCourse}
    />
  );
}
