"use client";

import React, { useState, useMemo } from "react";
import {
  BookOpen,
  Search,
  Eye,
  PlusCircle,
  CheckCircle2,
  Layers,
  Sparkles,
  FileText,
  User as UserIcon,
  ArrowRight,
  X,
  RefreshCw,
  Library,
  ShieldCheck,
  GraduationCap,
  Trash2,
} from "lucide-react";
import { Course } from "@/types/course";
import { AppUser, isCourseOwnedByUser } from "@/lib/storage";
import { runWithFeedback } from "@/lib/feedback";

interface BookLibraryViewProps {
  libraryCourses: Course[];
  myCourses: Course[];
  currentUser: AppUser | null;
  onApplyCourse: (libraryCourse: Course) => Promise<Course>;
  onOpenMyCourse: (courseId: string) => void;
  onRefreshLibrary: () => Promise<void>;
  onOpenCreateModal: () => void;
  onDeleteLibraryCourse?: (courseId: string, e: React.MouseEvent) => Promise<void>;
}

export default function BookLibraryView({
  libraryCourses,
  myCourses,
  currentUser,
  onApplyCourse,
  onOpenMyCourse,
  onRefreshLibrary,
  onOpenCreateModal,
  onDeleteLibraryCourse,
}: BookLibraryViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "community" | "mine">(
    "all"
  );
  const [levelFilter, setLevelFilter] = useState<
    "ALL" | "A1-A2" | "B1-B2" | "C1-C2"
  >("ALL");
  const [inspectingCourse, setInspectingCourse] = useState<Course | null>(null);
  const [inspectChapterIndex, setInspectChapterIndex] = useState<number>(0);
  const [applyingCourseId, setApplyingCourseId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [appliedSuccessBanner, setAppliedSuccessBanner] = useState<{
    title: string;
    newCourseId: string;
  } | null>(null);

  // Tìm bản khóa học tương ứng trong Tủ sách cá nhân của user (nếu đã Apply hoặc chính user là chủ sở hữu)
  const findOwnedMatch = (libCourse: Course): Course | undefined => {
    const sourceId = libCourse.clonedFromCourseId || libCourse.id;
    return myCourses.find(
      (mc) =>
        mc.id === libCourse.id ||
        mc.clonedFromCourseId === sourceId ||
        (mc.title.trim().toLowerCase() ===
          libCourse.title.trim().toLowerCase() &&
          mc.chapters.length === libCourse.chapters.length)
    );
  };

  const filteredLibrary = useMemo(() => {
    return libraryCourses.filter((c) => {
      const isMine = isCourseOwnedByUser(c, currentUser);
      if (sourceFilter === "mine" && !isMine) return false;
      if (sourceFilter === "community" && isMine) return false;

      if (levelFilter === "A1-A2" && !["A1", "A2"].includes(c.level)) {
        return false;
      }
      if (levelFilter === "B1-B2" && !["B1", "B2"].includes(c.level)) {
        return false;
      }
      if (levelFilter === "C1-C2" && !["C1", "C2"].includes(c.level)) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchTitle = c.title.toLowerCase().includes(q);
        const matchAuthor = (c.author || "").toLowerCase().includes(q);
        const matchDesc = (c.description || "").toLowerCase().includes(q);
        const matchOwner =
          (c.ownerName || "").toLowerCase().includes(q) ||
          (c.ownerEmail || "").toLowerCase().includes(q);
        return matchTitle || matchAuthor || matchDesc || matchOwner;
      }

      return true;
    });
  }, [libraryCourses, currentUser, sourceFilter, levelFilter, searchQuery]);

  const handleApply = async (course: Course, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const existing = findOwnedMatch(course);
    if (existing) {
      onOpenMyCourse(existing.id);
      return;
    }

    setApplyingCourseId(course.id);
    try {
      const cloned = await runWithFeedback(
        {
          variant: "sync",
          loadingTitle: `Đang thêm "${course.title}" vào Tủ sách...`,
          loadingSubtitle: "Đồng bộ bài giảng đã soạn và khởi tạo Flashcard SRS",
          successTitle: "Đã thêm sách vào Tủ sách cá nhân!",
          successMessage: course.title,
        },
        () => onApplyCourse(course)
      );
      setAppliedSuccessBanner({
        title: cloned.title,
        newCourseId: cloned.id,
      });
      setTimeout(() => {
        setAppliedSuccessBanner((prev) =>
          prev?.newCourseId === cloned.id ? null : prev
        );
      }, 2000);
    } finally {
      setApplyingCourseId(null);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await runWithFeedback(
        {
          variant: "sync",
          loadingTitle: "Đang làm mới Thư viện Sách Cộng đồng...",
          loadingSubtitle: "Đồng bộ các giáo trình & bài giảng mới nhất từ Supabase",
          successTitle: "Đã cập nhật Thư viện Sách!",
        },
        () => onRefreshLibrary()
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const getUploaderLabel = (course: Course): string => {
    if (course.isLibrarySample || course.id === "course-sample-habits") {
      return "BookMind Official";
    }
    if (isCourseOwnedByUser(course, currentUser)) {
      return "Do bạn tải lên";
    }
    if (course.ownerName) {
      return course.ownerName;
    }
    if (course.ownerEmail) {
      return course.ownerEmail.split("@")[0];
    }
    return "Thành viên Cộng đồng";
  };

  const activeInspectChapter =
    inspectingCourse?.chapters[inspectChapterIndex] ||
    inspectingCourse?.chapters[0] ||
    null;

  const flatBannerColors = [
    "bg-[#F3C969]",
    "bg-[#A7D7A9]",
    "bg-[#C8B6FF]",
    "bg-[#B8D8F8]",
  ];

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-3.5 py-5 sm:px-6 sm:py-8 space-y-6">
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-4 sm:p-6 shadow-[4px_4px_0_0_#F5EFE6]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#F5EFE6] bg-[#C8B6FF] px-3 py-1 text-xs font-extrabold text-[#141413] shadow-[2px_2px_0_0_#F5EFE6]">
              <Library className="h-3.5 w-3.5 text-[#141413]" />
              <span>Kho Thư Viện Sách Cộng Đồng ({libraryCourses.length} đầu sách)</span>
            </div>
            <h1 className="text-lg sm:text-2xl font-extrabold text-[#F5EFE6]">
              Thư Viện Sách Chung — Đọc Thử &amp; Nạp Vào Tủ Cá Nhân
            </h1>
            <p className="text-xs sm:text-sm text-[#B8B2A6] leading-relaxed">
              Mỗi tài khoản có <strong className="text-[#F5EFE6]">Tủ sách cá nhân độc lập</strong>. Bạn có thể bấm{" "}
              <span className="text-[#B8D8F8] font-bold">
                &ldquo;Xem &amp; Kiểm tra&rdquo;
              </span>{" "}
              để đọc thử từng chương, hoặc bấm{" "}
              <span className="text-[#A7D7A9] font-bold">
                &ldquo;Apply vào Tủ sách&rdquo;
              </span>{" "}
              để lưu bản sao riêng vào tài khoản của bạn.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex min-h-[42px] items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#141413] hover:bg-[#2A2823] px-3.5 py-2 text-xs font-bold text-[#F5EFE6] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-[#F3C969] ${
                  isRefreshing ? "animate-spin" : ""
                }`}
              />
              <span>Làm mới</span>
            </button>

            <button
              type="button"
              onClick={onOpenCreateModal}
              className="flex min-h-[42px] items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-4 py-2 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Tải sách mới lên</span>
            </button>
          </div>
        </div>
      </div>

      {/* Applied Success Notification Banner */}
      {appliedSuccessBanner && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] p-4 text-xs text-[#141413] shadow-[4px_4px_0_0_#F5EFE6]">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-[#141413] shrink-0" />
            <div>
              <p className="font-extrabold text-[#141413] text-sm">
                Đã Apply sách &ldquo;{appliedSuccessBanner.title}&rdquo; vào Tủ sách cá nhân của bạn!
              </p>
              <p className="text-[#141413]/85 mt-0.5 font-medium">
                Một bản sao độc lập với tiến độ học tập riêng đã được gắn vào tài khoản{" "}
                <strong>{currentUser?.email}</strong>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenMyCourse(appliedSuccessBanner.newCourseId)}
              className="flex items-center gap-1.5 rounded-xl border-2 border-[#141413] bg-[#F3C969] px-4 py-2 text-xs font-extrabold text-[#141413] shadow-[2px_2px_0_0_#141413] transition-transform active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
            >
              <span>Mở học ngay</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setAppliedSuccessBanner(null)}
              className="rounded-lg border-2 border-[#141413] bg-[#141413] p-1.5 text-[#F5EFE6] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Search & Filters Bar */}
      <div className="flex flex-col gap-3 rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-4 shadow-[4px_4px_0_0_#F5EFE6] lg:flex-row lg:items-center lg:justify-between">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B8B2A6]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên sách, tác giả, chủ đề hoặc tên người tải lên..."
            className="w-full rounded-lg border-2 border-[#F5EFE6] bg-[#141413] pl-10 pr-9 py-2.5 text-xs sm:text-sm font-medium text-[#F5EFE6] placeholder-[#B8B2A6] focus:border-[#F3C969] focus:shadow-[2px_2px_0_0_#F3C969] focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B8B2A6] hover:text-[#F5EFE6]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Pills (Cuộn ngang mượt trên mobile, không rớt dòng lộn xộn) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <div className="flex shrink-0 items-center gap-1 rounded-xl border-2 border-[#3A3832] bg-[#141413] p-1">
            {(
              [
                { id: "all", label: "Tất cả sách" },
                { id: "community", label: "Cộng đồng chia sẻ" },
                { id: "mine", label: "Sách tôi đã up" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSourceFilter(tab.id)}
                className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-extrabold transition-colors cursor-pointer ${
                  sourceFilter === tab.id
                    ? "bg-[#F3C969] text-[#141413]"
                    : "text-[#B8B2A6] hover:text-[#F5EFE6]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-1 rounded-xl border-2 border-[#3A3832] bg-[#141413] p-1">
            {(["ALL", "A1-A2", "B1-B2", "C1-C2"] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setLevelFilter(lvl)}
                className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-extrabold transition-colors cursor-pointer ${
                  levelFilter === lvl
                    ? "bg-[#C8B6FF] text-[#141413]"
                    : "text-[#B8B2A6] hover:text-[#F5EFE6]"
                }`}
              >
                {lvl === "ALL" ? "Mọi CEFR" : lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Books Grid */}
      {filteredLibrary.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#F5EFE6] bg-[#1D1C19] py-16 px-4 text-center">
          <BookOpen className="h-10 w-10 text-[#F3C969] mb-3" />
          <p className="text-base font-extrabold text-[#F5EFE6]">
            Không tìm thấy cuốn sách nào phù hợp
          </p>
          <p className="mt-1 text-xs text-[#B8B2A6] max-w-md">
            Hãy thử đổi từ khóa tìm kiếm hoặc bấm &ldquo;Đóng góp / Tải sách mới lên&rdquo; để thêm sách PDF/TXT mới.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredLibrary.map((course, idx) => {
            const totalChapters = course.chapters.length;
            const generatedChapters = course.chapters.filter(
              (c) => c.isGenerated
            ).length;
            const totalVocab = course.chapters.reduce(
              (sum, ch) => sum + (ch.lesson?.vocabulary?.length || 0),
              0
            );
            const ownedCopy = findOwnedMatch(course);
            const isOwnedByMe = Boolean(ownedCopy);
            const isUploadedByMe = isCourseOwnedByUser(course, currentUser);
            const uploaderLabel = getUploaderLabel(course);
            const isApplyingThis = applyingCourseId === course.id;
            const bannerBg = flatBannerColors[idx % flatBannerColors.length];

            return (
              <div
                key={course.id}
                className="group flex flex-col overflow-hidden rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] shadow-[4px_4px_0_0_#F5EFE6]"
              >
                {/* Top Cover Banner (Flat Pastel) */}
                <div
                  className={`relative border-b-2 border-[#F5EFE6] ${bannerBg} p-5 text-[#141413]`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-lg border-2 border-[#141413] bg-[#141413] px-2.5 py-0.5 text-xs font-extrabold text-[#F5EFE6]">
                        CEFR {course.level}
                      </span>
                      <span className="rounded-lg border-2 border-[#141413] bg-[#F5EFE6] px-2 py-0.5 text-[11px] font-bold text-[#141413]">
                        {course.targetLanguage}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isOwnedByMe && (
                        <span className="inline-flex items-center gap-1 rounded-full border-2 border-[#141413] bg-[#A7D7A9] px-2.5 py-0.5 text-[11px] font-extrabold text-[#141413]">
                          <CheckCircle2 className="h-3 w-3" />
                          Đã có trong Tủ sách
                        </span>
                      )}
                      {onDeleteLibraryCourse &&
                        isUploadedByMe &&
                        !course.clonedFromCourseId &&
                        !course.isLibrarySample && (
                          <button
                            type="button"
                            onClick={(e) => onDeleteLibraryCourse(course.id, e)}
                            title="Xóa sách đã tải lên"
                            className="inline-flex items-center gap-1 rounded-full border-2 border-[#141413] bg-[#FF8A8A] px-2.5 py-0.5 text-[11px] font-extrabold text-[#141413] transition-transform active:translate-y-[1px] cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Xóa sách</span>
                          </button>
                        )}
                    </div>
                  </div>

                  <h3 className="mt-4 line-clamp-2 text-lg font-extrabold text-[#141413]">
                    {course.title}
                  </h3>
                  <p className="mt-1 text-xs font-bold text-[#141413]/80">
                    Tác giả: {course.author || "Chưa rõ"}
                  </p>
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
                  <div className="space-y-3">
                    {/* Uploader Badge */}
                    <div className="flex items-center justify-between gap-2 rounded-lg border-2 border-[#3A3832] bg-[#141413] px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <UserIcon className="h-3.5 w-3.5 text-[#C8B6FF] shrink-0" />
                        <span className="text-[#B8B2A6] shrink-0">Nguồn:</span>
                        <span className="font-bold text-[#F5EFE6] truncate">
                          {uploaderLabel}
                        </span>
                      </div>
                      {isUploadedByMe && (
                        <span className="shrink-0 rounded-md border border-[#F5EFE6] bg-[#C8B6FF] px-1.5 py-0.5 text-[10px] font-extrabold text-[#141413]">
                          Sách gốc của bạn
                        </span>
                      )}
                    </div>

                    <p className="line-clamp-2 text-xs leading-relaxed text-[#B8B2A6]">
                      {course.description}
                    </p>

                    {/* Metadata Pills */}
                    <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                      <span className="inline-flex items-center gap-1 rounded-lg border-2 border-[#3A3832] bg-[#141413] px-2.5 py-1 text-[#F5EFE6]">
                        <Layers className="h-3 w-3 text-[#C8B6FF]" />
                        {totalChapters} chương
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg border-2 border-[#3A3832] bg-[#141413] px-2.5 py-1 text-[#F5EFE6]">
                        <Sparkles className="h-3 w-3 text-[#A7D7A9]" />
                        {generatedChapters}/{totalChapters} chương đã soạn AI
                      </span>
                      {totalVocab > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-lg border-2 border-[#3A3832] bg-[#141413] px-2.5 py-1 text-[#F5EFE6]">
                          <GraduationCap className="h-3 w-3 text-[#F3C969]" />
                          {totalVocab} từ vựng
                        </span>
                      )}
                      {course.sourceFileSizeMB && (
                        <span className="inline-flex items-center gap-1 rounded-lg border-2 border-[#3A3832] bg-[#141413] px-2.5 py-1 text-[#F5EFE6]">
                          <FileText className="h-3 w-3 text-[#B8D8F8]" />
                          PDF {course.sourceFileSizeMB} MB
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons: Inspect & Apply */}
                  <div className="grid grid-cols-2 gap-2.5 border-t-2 border-[#3A3832] pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setInspectingCourse(course);
                        setInspectChapterIndex(0);
                      }}
                      className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#141413] hover:bg-[#2A2823] px-3 py-2.5 text-xs font-bold text-[#F5EFE6] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5 text-[#B8D8F8] shrink-0" />
                      <span>Xem &amp; Kiểm tra</span>
                    </button>

                    {isOwnedByMe && ownedCopy ? (
                      <button
                        type="button"
                        onClick={() => onOpenMyCourse(ownedCopy.id)}
                        className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-3 py-2.5 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
                      >
                        <span>Mở trong Tủ sách</span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isApplyingThis}
                        onClick={(e) => handleApply(course, e)}
                        className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-3 py-2.5 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer disabled:opacity-50"
                      >
                        <PlusCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {isApplyingThis ? "Đang Apply..." : "Apply vào Tủ sách"}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL XEM & KIỂM TRA SÁCH TRƯỚC KHI APPLY */}
      {inspectingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141413]/85 p-3 sm:p-6">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] shadow-[6px_6px_0_0_#F5EFE6]">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b-2 border-[#F5EFE6] bg-[#F3C969] px-5 py-4 text-[#141413]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border-2 border-[#141413] bg-[#141413] px-2 py-0.5 text-[11px] font-extrabold text-[#F5EFE6]">
                    Kiểm tra nội dung sách
                  </span>
                  <span className="rounded-md border-2 border-[#141413] bg-[#F5EFE6] px-2 py-0.5 text-[11px] font-bold text-[#141413]">
                    CEFR {inspectingCourse.level} • {inspectingCourse.targetLanguage}
                  </span>
                  <span className="rounded-md border-2 border-[#141413] bg-[#C8B6FF] px-2 py-0.5 text-[11px] font-bold text-[#141413]">
                    Nguồn: {getUploaderLabel(inspectingCourse)}
                  </span>
                </div>
                <h2 className="mt-1.5 text-base sm:text-xl font-extrabold text-[#141413] truncate">
                  {inspectingCourse.title}
                </h2>
                <p className="text-xs font-bold text-[#141413]/80">
                  Tác giả: {inspectingCourse.author} • {inspectingCourse.chapters.length} chương
                </p>
              </div>

              <button
                type="button"
                onClick={() => setInspectingCourse(null)}
                className="rounded-xl border-2 border-[#141413] bg-[#141413] p-2 text-[#F5EFE6] hover:bg-[#FF8A8A] hover:text-[#141413] transition-colors cursor-pointer shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content: Left Chapter List + Right Chapter Content Preview */}
            <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
              {/* Left Sidebar: Chapters List */}
              <div className="w-full md:w-72 shrink-0 border-b-2 md:border-b-0 md:border-r-2 border-[#3A3832] bg-[#141413] p-3 overflow-y-auto max-h-48 md:max-h-none">
                <p className="px-2 pb-2 text-[11px] font-extrabold uppercase tracking-wider text-[#B8B2A6]">
                  Mục lục ({inspectingCourse.chapters.length} Chương)
                </p>
                <div className="space-y-1.5">
                  {inspectingCourse.chapters.map((ch, idx) => {
                    const isSelected = idx === inspectChapterIndex;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setInspectChapterIndex(idx)}
                        className={`w-full rounded-xl border-2 p-2.5 text-left transition-colors cursor-pointer ${
                          isSelected
                            ? "border-[#F5EFE6] bg-[#F3C969] text-[#141413]"
                            : "border-[#3A3832] bg-[#1D1C19] text-[#F5EFE6] hover:border-[#F5EFE6]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-xs font-extrabold truncate">
                            Chương {ch.index}: {ch.title}
                          </span>
                          {ch.isGenerated && (
                            <span className="shrink-0 rounded bg-[#A7D7A9] px-1.5 py-0.5 text-[9px] font-extrabold text-[#141413]">
                              AI Ready
                            </span>
                          )}
                        </div>
                        {ch.startPage && ch.endPage && (
                          <p
                            className={`mt-0.5 text-[10px] font-semibold ${
                              isSelected ? "text-[#141413]/80" : "text-[#B8B2A6]"
                            }`}
                          >
                            Trang {ch.startPage}–{ch.endPage}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Panel: Selected Chapter Details */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                {activeInspectChapter ? (
                  <>
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-base sm:text-lg font-extrabold text-[#F5EFE6]">
                          Chương {activeInspectChapter.index}:{" "}
                          {activeInspectChapter.title}
                        </h3>
                        <span
                          className={`rounded-full border-2 border-[#F5EFE6] px-2.5 py-0.5 text-xs font-extrabold ${
                            activeInspectChapter.isGenerated
                              ? "bg-[#A7D7A9] text-[#141413]"
                              : "bg-[#141413] text-[#B8B2A6]"
                          }`}
                        >
                          {activeInspectChapter.isGenerated
                            ? "Đã có sẵn Bài giảng AI, Từ vựng & Bài tập"
                            : "Chứa văn bản gốc (Sẽ phân tích AI khi học)"}
                        </span>
                      </div>
                      {activeInspectChapter.summary && (
                        <p className="mt-1.5 text-xs text-[#B8B2A6]">
                          {activeInspectChapter.summary}
                        </p>
                      )}
                    </div>

                    {/* Raw Text Excerpt Preview */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-[#B8D8F8] uppercase tracking-wider">
                          Nội dung văn bản gốc trong chương ({activeInspectChapter.rawText?.length || 0} ký tự)
                        </span>
                      </div>
                      <div className="max-h-56 overflow-y-auto rounded-lg border-2 border-[#3A3832] bg-[#141413] p-3.5 text-xs leading-relaxed text-[#F5EFE6] whitespace-pre-wrap font-mono">
                        {activeInspectChapter.rawText
                          ? activeInspectChapter.rawText.slice(0, 2500) +
                            (activeInspectChapter.rawText.length > 2500
                              ? "\n\n... [Nội dung đầy đủ sẽ được nạp khi Apply vào Tủ sách]"
                              : "")
                          : "(Chương dùng ảnh quét trang PDF Scanned Pages)"}
                      </div>
                    </div>

                    {/* Pre-generated AI Lesson Preview (if available) */}
                    {activeInspectChapter.lesson && (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="rounded-lg border-2 border-[#3A3832] bg-[#141413] p-3.5">
                          <p className="text-xs font-extrabold text-[#F3C969] mb-2">
                            Từ vựng có sẵn ({activeInspectChapter.lesson.vocabulary?.length || 0} từ)
                          </p>
                          <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {activeInspectChapter.lesson.vocabulary
                              ?.slice(0, 8)
                              .map((v) => (
                                <div
                                  key={v.id}
                                  className="flex items-center justify-between gap-2 text-xs border-b border-[#3A3832] pb-1"
                                >
                                  <span className="font-bold text-[#F5EFE6]">
                                    {v.word}{" "}
                                    <span className="text-[#B8B2A6] font-normal">
                                      {v.ipa}
                                    </span>
                                  </span>
                                  <span className="text-[#B8B2A6] truncate max-w-[140px]">
                                    {v.vietnameseMeaning}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>

                        <div className="rounded-lg border-2 border-[#3A3832] bg-[#141413] p-3.5">
                          <p className="text-xs font-extrabold text-[#A7D7A9] mb-2">
                            Cấu trúc Ngữ pháp ({activeInspectChapter.lesson.grammarPoints?.length || 0} chủ điểm)
                          </p>
                          <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {activeInspectChapter.lesson.grammarPoints?.map(
                              (g) => (
                                <div
                                  key={g.id}
                                  className="text-xs border-b border-[#3A3832] pb-1.5"
                                >
                                  <p className="font-bold text-[#F5EFE6]">
                                    {g.title}
                                  </p>
                                  <p className="text-[11px] text-[#C8B6FF]">
                                    {g.patternFormula}
                                  </p>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-[#B8B2A6]">
                    Sách này chưa có chương nào.
                  </p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-[#3A3832] bg-[#141413] px-5 py-3.5">
              <div className="flex items-center gap-2 text-xs text-[#B8B2A6]">
                <ShieldCheck className="h-4 w-4 text-[#A7D7A9] shrink-0" />
                <span>
                  Khi bấm Apply, sách sẽ được nhân bản độc lập vào tài khoản của bạn (không ảnh hưởng dữ liệu người đăng).
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setInspectingCourse(null)}
                  className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] px-4 py-2 text-xs font-bold text-[#F5EFE6] shadow-[2px_2px_0_0_#F5EFE6] transition-transform active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                >
                  Đóng
                </button>

                {(() => {
                  const owned = findOwnedMatch(inspectingCourse);
                  if (owned) {
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          setInspectingCourse(null);
                          onOpenMyCourse(owned.id);
                        }}
                        className="flex items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-5 py-2 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Đã có trong Tủ sách • Mở học ngay</span>
                      </button>
                    );
                  }
                  return (
                    <button
                      type="button"
                      disabled={applyingCourseId === inspectingCourse.id}
                      onClick={async () => {
                        const target = inspectingCourse;
                        setInspectingCourse(null);
                        await handleApply(target);
                      }}
                      className="flex items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-5 py-2 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer disabled:opacity-50"
                    >
                      <PlusCircle className="h-4 w-4" />
                      <span>Apply sách này vào Tài khoản của tôi</span>
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

