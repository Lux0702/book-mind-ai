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

const FLAT_SPINE_COLORS = [
  "bg-[#F3C969]",
  "bg-[#A7D7A9]",
  "bg-[#C8B6FF]",
  "bg-[#B8D8F8]",
];

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

  return (
    <div className="bm-view-enter mx-auto w-full max-w-7xl flex-1 px-3.5 py-4 sm:px-6 sm:py-8">
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
      />

      {/* Top Stats Banner (2-col compact on mobile, 4-col on desktop) */}
      <div className="mb-5 sm:mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-3.5 sm:p-5 shadow-[4px_4px_0_0_#F5EFE6]">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-bold text-[#B8B2A6]">
            <span className="truncate">Tủ Sách Cá Nhân</span>
            <BookOpen className="h-4 w-4 text-[#C8B6FF] shrink-0" />
          </div>
          <div className="mt-1.5 text-lg sm:text-2xl font-extrabold text-[#F5EFE6]">
            {courses.length}{" "}
            <span className="text-[11px] sm:text-xs font-semibold text-[#B8B2A6]">
              cuốn
            </span>
          </div>
          <div className="mt-0.5 text-[10px] sm:text-[11px] text-[#B8B2A6] truncate">
            Lộ trình học tập độc lập
          </div>
        </div>

        <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-3.5 sm:p-5 shadow-[4px_4px_0_0_#F5EFE6]">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-bold text-[#B8B2A6]">
            <span className="truncate">Chương Đã Soạn</span>
            <Layers className="h-4 w-4 text-[#A7D7A9] shrink-0" />
          </div>
          <div className="mt-1.5 text-lg sm:text-2xl font-extrabold text-[#F5EFE6]">
            {courses.reduce(
              (acc, c) => acc + c.chapters.filter((ch) => ch.isGenerated).length,
              0
            )}{" "}
            <span className="text-xs sm:text-sm font-semibold text-[#B8B2A6]">
              / {courses.reduce((acc, c) => acc + c.chapters.length, 0)}
            </span>
          </div>
          <div className="mt-0.5 text-[10px] sm:text-[11px] text-[#B8B2A6] truncate">
            Phân tích sâu &amp; Bài tập
          </div>
        </div>

        <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-3.5 sm:p-5 shadow-[4px_4px_0_0_#F5EFE6]">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-bold text-[#B8B2A6]">
            <span className="truncate">Kho Từ Vựng SRS</span>
            <GraduationCap className="h-4 w-4 text-[#F3C969] shrink-0" />
          </div>
          <div className="mt-1.5 text-lg sm:text-2xl font-extrabold text-[#F5EFE6]">
            {flashcards.length}{" "}
            <span className="text-[11px] sm:text-xs font-semibold text-[#B8B2A6]">
              từ
            </span>
          </div>
          <div className="mt-0.5 text-[10px] sm:text-[11px] font-bold text-[#F3C969] truncate">
            {dueFlashcards.length} thẻ đến hạn hôm nay
          </div>
        </div>

        <div
          onClick={() => setIsUpgradeModalOpen(true)}
          className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-3.5 sm:p-5 shadow-[4px_4px_0_0_#F5EFE6] cursor-pointer transition-transform hover:bg-[#25241F] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6]"
        >
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-bold text-[#B8B2A6]">
            <span className="truncate">Gói AI Credit</span>
            <Crown className="h-4 w-4 text-[#F3C969] shrink-0" />
          </div>
          <div className="mt-1.5 text-sm sm:text-base font-extrabold text-[#F5EFE6] truncate">
            {quotaAccount
              ? PLAN_CONFIG[quotaAccount.plan].name
              : "Gói Free (30 Credit)"}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold truncate">
            {quotaAccount?.isKeyActivated ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-[#A7D7A9] shrink-0" />
                <span className="text-[#A7D7A9] truncate">
                  {quotaAccount.plan === "unlimited"
                    ? `Đã dùng ${quotaAccount.usedCalls} • VIP`
                    : `${quotaAccount.usedCalls}/${quotaAccount.maxCalls} Credit`}
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-[#F3C969] shrink-0" />
                <span className="text-[#F3C969] truncate">
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
          <h2 className="text-lg sm:text-xl font-extrabold text-[#F5EFE6]">
            Tủ Sách Cá Nhân ({courses.length} cuốn)
          </h2>
          <p className="text-xs text-[#B8B2A6] mt-0.5">
            Đồng bộ đám mây theo tài khoản{" "}
            <strong className="font-bold text-[#F5EFE6]">
              {currentUser?.email}
            </strong>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("bookmind:route-start"));
              router.push(ROUTES.topicVocab);
            }}
            className="flex min-h-[40px] items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-3.5 py-2 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span>Từ vựng Chủ đề (5.000+ từ &amp; AI)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("bookmind:route-start"));
              router.push(ROUTES.library);
            }}
            className="flex min-h-[40px] items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#B8D8F8] px-3.5 py-2 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
          >
            <Library className="h-3.5 w-3.5 shrink-0" />
            <span>Thư viện ({libraryCourses.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex min-h-[40px] items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-3.5 py-2 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span>Nạp sách mới</span>
          </button>
        </div>
      </div>

      {/* Courses Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-sm font-semibold text-[#B8B2A6]">
          Đang tải dữ liệu các khóa học...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course, idx) => {
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
            const spineColor =
              FLAT_SPINE_COLORS[idx % FLAT_SPINE_COLORS.length];

            return (
              <div
                key={course.id}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("bookmind:route-start"));
                  router.push(ROUTES.book(course.id));
                }}
                className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] shadow-[4px_4px_0_0_#F5EFE6] transition-transform hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6]"
              >
                {/* Flat Book Spine Accent + Header */}
                <div className="relative border-b-2 border-[#3A3832] p-5 pt-6">
                  <div
                    className={`absolute inset-x-0 top-0 h-2 border-b-2 border-[#F5EFE6] ${spineColor}`}
                  />
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border-2 border-[#F5EFE6] bg-[#C8B6FF] px-2.5 py-0.5 text-[11px] font-extrabold text-[#141413] shadow-[2px_2px_0_0_#F5EFE6]">
                        CEFR {course.level}
                      </span>
                      <span className="rounded-full border-2 border-[#3A3832] bg-[#141413] px-2.5 py-0.5 text-[11px] font-bold text-[#F5EFE6]">
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
                          className="inline-flex items-center gap-1 rounded-lg border-2 border-[#3A3832] bg-[#141413] px-2 py-1 text-[11px] font-bold text-[#FF8A8A] hover:border-[#FF8A8A] transition cursor-pointer"
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
                  <h3 className="mt-3.5 line-clamp-2 text-base sm:text-lg font-extrabold text-[#F5EFE6] group-hover:text-[#F3C969]">
                    {course.title}
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-[#B8B2A6]">
                    {course.author}
                  </p>
                </div>

                {/* Card Body */}
                <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
                  <div className="space-y-3">
                    <p className="line-clamp-2 text-xs leading-relaxed text-[#B8B2A6]">
                      {course.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
                      <span className="inline-flex items-center gap-1 rounded-lg border-2 border-[#3A3832] bg-[#141413] px-2 py-1 text-[#F5EFE6]">
                        <Layers className="h-3 w-3 text-[#C8B6FF]" />
                        {totalChapters} chương
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg border-2 border-[#3A3832] bg-[#141413] px-2 py-1 text-[#F5EFE6]">
                        <Sparkles className="h-3 w-3 text-[#F3C969]" />
                        {courseCards.length} từ vựng
                      </span>
                      {course.sourceFileSizeMB && (
                        <span className="inline-flex items-center gap-1 rounded-lg border-2 border-[#3A3832] bg-[#141413] px-2 py-1 text-[#F5EFE6]">
                          <FileText className="h-3 w-3 text-[#A7D7A9]" />
                          PDF {course.sourceFileSizeMB} MB
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    {/* Progress bar */}
                    <div>
                      <div className="mb-1.5 flex justify-between text-[11px] font-bold text-[#B8B2A6]">
                        <span>
                          Đã soạn {generatedChapters}/{totalChapters} chương
                        </span>
                        <span className="text-[#F5EFE6]">
                          {totalCompletedEx} bài tập
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full border-2 border-[#F5EFE6] bg-[#141413]">
                        <div
                          className="h-full bg-[#A7D7A9] transition-all"
                          style={{ width: `${Math.max(progressPct, 5)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t-2 border-[#3A3832] pt-3 text-xs font-extrabold text-[#F3C969]">
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
            className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#B8D8F8] bg-[#1D1C19] p-6 text-center transition-transform hover:bg-[#25241F] active:translate-x-[2px] active:translate-y-[2px] cursor-pointer"
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border-2 border-[#F5EFE6] bg-[#B8D8F8] text-[#141413] shadow-[3px_3px_0_0_#F5EFE6]">
              <Library className="h-6 w-6" />
            </div>
            <h3 className="text-base font-extrabold text-[#F5EFE6]">
              Khám Phá Thư Viện Sách
            </h3>
            <p className="mt-1 max-w-xs text-xs text-[#B8B2A6]">
              Xem &amp; kiểm tra các sách do cộng đồng đã tải lên và bấm Apply để thêm ngay vào Tủ sách của bạn
            </p>
          </button>

          {/* Add New Course Card */}
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#A7D7A9] bg-[#1D1C19] p-6 text-center transition-transform hover:bg-[#25241F] active:translate-x-[2px] active:translate-y-[2px] cursor-pointer"
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] text-[#141413] shadow-[3px_3px_0_0_#F5EFE6]">
              <Plus className="h-6 w-6" />
            </div>
            <h3 className="text-base font-extrabold text-[#F5EFE6]">
              + Tải Sách Mới Của Bạn Lên
            </h3>
            <p className="mt-1 max-w-xs text-xs text-[#B8B2A6]">
              Tải lên file PDF (kể cả sách 80MB+), TXT hoặc dán văn bản để AI tạo một Course độc lập
            </p>
          </button>
        </div>
      )}
    </div>
  );
}
