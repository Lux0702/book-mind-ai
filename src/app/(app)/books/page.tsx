"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Plus,
  Layers,
  Sparkles,
  Trash2,
  ArrowRight,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Crown,
  FileText,
  Library,
} from "lucide-react";
import { isCourseOwnedByUser } from "@/lib/storage";
import { PLAN_CONFIG } from "@/lib/quotaManager";
import { ROUTES } from "@/lib/routes";
import ContinueLearningBanner from "@/components/ContinueLearningBanner";
import { useAppData } from "@/components/app/AppDataProvider";

export default function BooksPage() {
  const router = useRouter();
  const {
    courses,
    libraryCourses,
    flashcards,
    dueFlashcards,
    quotaAccount,
    currentUser,
    isLoading,
    handleDeleteCourse,
    setIsUpgradeModalOpen,
    setIsCreateOpen,
  } = useAppData();

  return (        <div
          className="bm-view-enter mx-auto w-full max-w-7xl flex-1 px-3.5 py-4 sm:px-6 sm:py-8"
        >
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
            className="mb-6"
          />          {/* Top Stats Banner (2-col compact on mobile, 4-col on desktop) */}
          <div className="mb-4 sm:mb-8 grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/[0.07] bg-[#0F1523]/90 p-3 sm:p-5">
              <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-400">
                <span className="truncate">Tủ Sách Cá Nhân</span>
                <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-400 shrink-0" />
              </div>
              <div className="mt-1 sm:mt-1.5 text-lg sm:text-2xl font-bold text-white">
                {courses.length}{" "}
                <span className="text-[11px] sm:text-xs font-normal text-slate-400">cuốn</span>
              </div>
              <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] text-slate-400 truncate">
                Lộ trình học tập độc lập
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-[#0F1523]/90 p-3 sm:p-5">
              <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-400">
                <span className="truncate">Chương Đã Soạn</span>
                <Layers className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400 shrink-0" />
              </div>
              <div className="mt-1 sm:mt-1.5 text-lg sm:text-2xl font-bold text-white">
                {courses.reduce(
                  (acc, c) =>
                    acc + c.chapters.filter((ch) => ch.isGenerated).length,
                  0
                )}{" "}
                <span className="text-xs sm:text-sm font-normal text-slate-500">
                  / {courses.reduce((acc, c) => acc + c.chapters.length, 0)}
                </span>
              </div>
              <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] text-slate-400 truncate">
                Phân tích sâu &amp; Bài tập
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-[#0F1523]/90 p-3 sm:p-5">
              <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-400">
                <span className="truncate">Kho Từ Vựng SRS</span>
                <GraduationCap className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400 shrink-0" />
              </div>
              <div className="mt-1 sm:mt-1.5 text-lg sm:text-2xl font-bold text-white">
                {flashcards.length}{" "}
                <span className="text-[11px] sm:text-xs font-normal text-slate-400">từ</span>
              </div>
              <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] text-amber-300/90 truncate">
                {dueFlashcards.length} thẻ đến hạn hôm nay
              </div>
            </div>

            <div
              onClick={() => setIsUpgradeModalOpen(true)}
              className="rounded-2xl border border-white/[0.07] bg-[#0F1523]/90 p-3 sm:p-5 cursor-pointer hover:border-indigo-500/40 transition"
            >
              <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-400">
                <span className="truncate">Gói AI Credit</span>
                <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400 shrink-0" />
              </div>
              <div className="mt-1 sm:mt-1.5 text-sm sm:text-base font-bold text-white truncate">
                {quotaAccount
                  ? PLAN_CONFIG[quotaAccount.plan].name
                  : "Gói Free (30 Credit)"}
              </div>
              <div className="mt-0.5 sm:mt-1 flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400 truncate">
                {quotaAccount?.isKeyActivated ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-400 shrink-0" />
                    <span className="text-emerald-300 truncate">
                      {quotaAccount.plan === "unlimited"
                        ? `Đã dùng ${quotaAccount.usedCalls} • VIP`
                        : `${quotaAccount.usedCalls}/${quotaAccount.maxCalls} Credit`}
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-400 shrink-0" />
                    <span className="text-amber-300 truncate">
                      Kích hoạt Key ngay
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Courses Section Header */}
          <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                Tủ Sách Cá Nhân ({courses.length} cuốn)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Đồng bộ đám mây theo tài khoản{" "}
                <strong className="font-semibold text-slate-200">
                  {currentUser?.email}
                </strong>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push(ROUTES.library)}
                className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#0F1523] hover:border-emerald-500/40 px-3.5 py-2 text-xs font-semibold text-emerald-300 transition cursor-pointer"
              >
                <Library className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Thư viện ({libraryCourses.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="flex min-h-[38px] items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3.5 py-2 text-xs font-semibold text-white transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span>Nạp sách mới</span>
              </button>
            </div>
          </div>

          {/* Courses Grid */}
          {isLoading ? (
            <div className="py-16 text-center text-sm text-slate-400">
              Đang tải dữ liệu các khóa học...
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => {
                const totalChapters = course.chapters.length;
                const generatedChapters = course.chapters.filter(
                  (c) => c.isGenerated
                ).length;
                const courseCards = flashcards.filter(
                  (f) => f.courseId === course.id
                );
                const totalCompletedEx = course.chapters.reduce(
                  (sum, ch) =>
                    sum +
                    ch.completedClozeIds.length +
                    ch.completedQuizIds.length +
                    ch.completedTranslationIds.length,
                  0
                );
                const progressPct =
                  totalChapters > 0
                    ? Math.round((generatedChapters / totalChapters) * 100)
                    : 0;

                return (
                  <div
                    key={course.id}
                    onClick={() => router.push(ROUTES.book(course.id))}
                    className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0F1523]/95 shadow-lg transition hover:-translate-y-0.5 hover:border-indigo-500/40"
                  >
                    {/* Editorial Book Spine Accent + Header */}
                    <div className="relative border-b border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-5">
                      <div
                        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${course.coverGradient}`}
                      />
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md border border-indigo-500/25 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-300">
                            CEFR {course.level}
                          </span>
                          <span className="rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-[11px] text-slate-400">
                            {course.targetLanguage}
                          </span>
                        </div>
                        {(() => {
                          const isAppliedBook = Boolean(course.clonedFromCourseId);
                          const isUploaderBook =
                            !isAppliedBook &&
                            isCourseOwnedByUser(course, currentUser);
                          if (!isAppliedBook && !isUploaderBook) return null;
                          return (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteCourse(course.id, e)}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-400 hover:bg-rose-500/15 hover:text-rose-400 transition cursor-pointer"
                              title={
                                isAppliedBook
                                  ? "Gỡ sách khỏi Tủ sách cá nhân"
                                  : "Xóa vĩnh viễn sách bạn đã tải lên"
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5 shrink-0" />
                              <span>
                                {isAppliedBook ? "Gỡ khỏi tủ" : "Xóa sách"}
                              </span>
                            </button>
                          );
                        })()}
                      </div>
                      <h3 className="mt-3.5 line-clamp-2 text-base sm:text-lg font-bold text-white group-hover:text-indigo-200 transition">
                        {course.title}
                      </h3>
                      <p className="mt-1 text-xs font-medium text-slate-400">
                        {course.author}
                      </p>
                    </div>

                    {/* Card Body */}
                    <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
                      <div className="space-y-3">
                        <p className="line-clamp-2 text-xs leading-relaxed text-slate-400">
                          {course.description}
                        </p>

                        <div className="flex flex-wrap gap-1.5 text-[11px]">
                          <span className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-slate-950/60 px-2 py-1 text-slate-300">
                            <Layers className="h-3 w-3 text-indigo-400" />
                            {totalChapters} chương
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-slate-950/60 px-2 py-1 text-slate-300">
                            <Sparkles className="h-3 w-3 text-amber-400" />
                            {courseCards.length} từ vựng
                          </span>
                          {course.sourceFileSizeMB && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-slate-950/60 px-2 py-1 text-slate-300">
                              <FileText className="h-3 w-3 text-emerald-400" />
                              PDF {course.sourceFileSizeMB} MB
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3 pt-1">
                        {/* Progress bar */}
                        <div>
                          <div className="mb-1.5 flex justify-between text-[11px] text-slate-400">
                            <span>
                              Đã soạn {generatedChapters}/{totalChapters} chương
                            </span>
                            <span className="font-medium text-slate-300">
                              {totalCompletedEx} bài tập
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900">
                            <div
                              className="h-full bg-indigo-500 transition-all"
                              style={{ width: `${Math.max(progressPct, 5)}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs font-semibold text-indigo-400 group-hover:text-indigo-300">
                          <span>Vào không gian đọc &amp; học</span>
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Browse Community Library Card */}
              <button
                type="button"
                onClick={() => router.push(ROUTES.library)}
                className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-500/30 bg-emerald-950/10 p-6 text-center transition hover:border-emerald-500/70 hover:bg-emerald-950/20 cursor-pointer"
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                  <Library className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-white">
                  Khám Phá Thư Viện Sách 
                </h3>
                <p className="mt-1 max-w-xs text-xs text-slate-400">
                  Xem &amp; kiểm tra các sách do cộng đồng đã tải lên và bấm Apply để thêm ngay vào Tủ sách của bạn
                </p>
              </button>

              {/* Add New Course Card */}
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/30 p-6 text-center transition hover:border-indigo-500 hover:bg-slate-900/60 cursor-pointer"
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-400">
                  <Plus className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-white">
                  + Tải Sách Mới Của Bạn Lên
                </h3>
                <p className="mt-1 max-w-xs text-xs text-slate-400">
                  Tải lên file PDF (kể cả sách 80MB+), TXT hoặc dán văn bản để AI tạo một Course độc lập
                </p>
              </button>
            </div>
          )}
        </div>
  );
}
