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
} from "lucide-react";
import { Course } from "@/types/course";
import { AppUser, isCourseOwnedByUser } from "@/lib/storage";

interface BookLibraryViewProps {
  libraryCourses: Course[];
  myCourses: Course[];
  currentUser: AppUser | null;
  onApplyCourse: (libraryCourse: Course) => Promise<Course>;
  onOpenMyCourse: (courseId: string) => void;
  onRefreshLibrary: () => Promise<void>;
  onOpenCreateModal: () => void;
}

export default function BookLibraryView({
  libraryCourses,
  myCourses,
  currentUser,
  onApplyCourse,
  onOpenMyCourse,
  onRefreshLibrary,
  onOpenCreateModal,
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
      const cloned = await onApplyCourse(course);
      setAppliedSuccessBanner({
        title: cloned.title,
        newCourseId: cloned.id,
      });
    } finally {
      setApplyingCourseId(null);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshLibrary();
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

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/15 px-3 py-1 text-xs font-bold text-indigo-300">
              <Library className="h-3.5 w-3.5 text-indigo-400" />
              <span>Kho Thư Viện Sách Cộng Đồng ({libraryCourses.length} đầu sách)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">
              Thư Viện Sách Chung — Xem Kiểm Tra & Apply Vào Tài Khoản
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Mỗi tài khoản có <strong>Tủ sách cá nhân tách biệt hoàn toàn</strong>. Tại Thư viện này, bạn có thể xem tất cả sách do các thành viên đã tải lên, bấm{" "}
              <span className="text-indigo-300 font-semibold">
                &ldquo;Xem &amp; Kiểm tra&rdquo;
              </span>{" "}
              để đọc thử nội dung từng chương, và bấm{" "}
              <span className="text-emerald-300 font-semibold">
                &ldquo;Apply vào Tủ sách&rdquo;
              </span>{" "}
              để tạo bản sao độc lập vào tài khoản của riêng bạn.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/90 hover:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-200 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-indigo-400 ${
                  isRefreshing ? "animate-spin" : ""
                }`}
              />
              <span>Làm mới Thư viện</span>
            </button>

            <button
              type="button"
              onClick={onOpenCreateModal}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 transition cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Đóng góp / Tải sách mới lên</span>
            </button>
          </div>
        </div>
      </div>

      {/* Applied Success Notification Banner */}
      {appliedSuccessBanner && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-4 text-xs text-emerald-200 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-white text-sm">
                Đã Apply sách &ldquo;{appliedSuccessBanner.title}&rdquo; vào Tủ sách cá nhân của bạn!
              </p>
              <p className="text-emerald-300/90 mt-0.5">
                Một bản sao độc lập với tiến độ học tập riêng đã được gắn vào tài khoản{" "}
                <strong>{currentUser?.email}</strong>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenMyCourse(appliedSuccessBanner.newCourseId)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow transition cursor-pointer"
            >
              <span>Mở học ngay</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setAppliedSuccessBanner(null)}
              className="rounded-lg p-1.5 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Search & Filters Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên sách, tác giả, chủ đề hoặc tên người tải lên..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl border border-slate-800 bg-slate-950 p-1">
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
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  sourceFilter === tab.id
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center rounded-xl border border-slate-800 bg-slate-950 p-1">
            {(["ALL", "A1-A2", "B1-B2", "C1-C2"] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setLevelFilter(lvl)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  levelFilter === lvl
                    ? "bg-slate-800 text-amber-300 border border-amber-500/30"
                    : "text-slate-400 hover:text-slate-200"
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
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-16 px-4 text-center">
          <BookOpen className="h-10 w-10 text-slate-600 mb-3" />
          <p className="text-base font-bold text-white">
            Không tìm thấy cuốn sách nào phù hợp
          </p>
          <p className="mt-1 text-xs text-slate-400 max-w-md">
            Hãy thử đổi từ khóa tìm kiếm hoặc bấm &ldquo;Đóng góp / Tải sách mới lên&rdquo; để thêm sách PDF/TXT mới.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredLibrary.map((course) => {
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

            return (
              <div
                key={course.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/85 shadow-lg transition hover:border-indigo-500/50"
              >
                {/* Top Cover Banner */}
                <div
                  className={`relative bg-gradient-to-r ${
                    course.coverGradient ||
                    "from-indigo-600 via-purple-600 to-pink-600"
                  } p-5`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-lg bg-black/35 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
                        CEFR {course.level}
                      </span>
                      <span className="rounded-lg bg-black/25 px-2 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
                        {course.targetLanguage}
                      </span>
                    </div>

                    {isOwnedByMe && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2.5 py-0.5 text-[11px] font-bold text-slate-950 shadow">
                        <CheckCircle2 className="h-3 w-3" />
                        Đã có trong Tủ sách
                      </span>
                    )}
                  </div>

                  <h3 className="mt-4 line-clamp-2 text-lg font-extrabold text-white">
                    {course.title}
                  </h3>
                  <p className="mt-1 text-xs font-medium text-white/85">
                    Tác giả: {course.author || "Chưa rõ"}
                  </p>
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
                  <div className="space-y-3">
                    {/* Uploader Badge */}
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-800/90 bg-slate-950/70 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <UserIcon className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                        <span className="text-slate-400 shrink-0">Nguồn:</span>
                        <span className="font-semibold text-slate-200 truncate">
                          {uploaderLabel}
                        </span>
                      </div>
                      {isUploadedByMe && (
                        <span className="shrink-0 rounded-md bg-indigo-500/20 border border-indigo-500/30 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300">
                          Sách gốc của bạn
                        </span>
                      )}
                    </div>

                    <p className="line-clamp-2 text-xs leading-relaxed text-slate-400">
                      {course.description}
                    </p>

                    {/* Metadata Pills */}
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-slate-300">
                        <Layers className="h-3 w-3 text-indigo-400" />
                        {totalChapters} chương
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-slate-300">
                        <Sparkles className="h-3 w-3 text-emerald-400" />
                        {generatedChapters}/{totalChapters} chương đã soạn AI
                      </span>
                      {totalVocab > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-slate-300">
                          <GraduationCap className="h-3 w-3 text-amber-400" />
                          {totalVocab} từ vựng
                        </span>
                      )}
                      {course.sourceFileSizeMB && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-slate-300">
                          <FileText className="h-3 w-3 text-sky-400" />
                          PDF {course.sourceFileSizeMB} MB
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons: Inspect & Apply */}
                  <div className="grid grid-cols-2 gap-2.5 border-t border-slate-800/80 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setInspectingCourse(course);
                        setInspectChapterIndex(0);
                      }}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 hover:border-slate-600 px-3 py-2.5 text-xs font-bold text-slate-200 transition cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                      <span>Xem &amp; Kiểm tra</span>
                    </button>

                    {isOwnedByMe && ownedCopy ? (
                      <button
                        type="button"
                        onClick={() => onOpenMyCourse(ownedCopy.id)}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 px-3 py-2.5 text-xs font-bold text-emerald-300 transition cursor-pointer"
                      >
                        <span>Mở trong Tủ sách</span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isApplyingThis}
                        onClick={(e) => handleApply(course, e)}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 px-3 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-6 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div
              className={`flex items-start justify-between gap-4 bg-gradient-to-r ${
                inspectingCourse.coverGradient ||
                "from-indigo-600 via-purple-600 to-pink-600"
              } px-5 py-4`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-black/35 px-2 py-0.5 text-[11px] font-bold text-white">
                    Kiểm tra nội dung sách
                  </span>
                  <span className="rounded-md bg-black/25 px-2 py-0.5 text-[11px] font-semibold text-white">
                    CEFR {inspectingCourse.level} • {inspectingCourse.targetLanguage}
                  </span>
                  <span className="rounded-md bg-black/25 px-2 py-0.5 text-[11px] text-white/90">
                    Nguồn: {getUploaderLabel(inspectingCourse)}
                  </span>
                </div>
                <h2 className="mt-1.5 text-base sm:text-xl font-extrabold text-white truncate">
                  {inspectingCourse.title}
                </h2>
                <p className="text-xs text-white/85">
                  Tác giả: {inspectingCourse.author} • {inspectingCourse.chapters.length} chương
                </p>
              </div>

              <button
                type="button"
                onClick={() => setInspectingCourse(null)}
                className="rounded-xl bg-black/30 p-2 text-white hover:bg-black/50 transition cursor-pointer shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content: Left Chapter List + Right Chapter Content Preview */}
            <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
              {/* Left Sidebar: Chapters List */}
              <div className="w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/60 p-3 overflow-y-auto max-h-48 md:max-h-none">
                <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
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
                        className={`w-full rounded-xl p-2.5 text-left transition cursor-pointer ${
                          isSelected
                            ? "bg-indigo-600/20 border border-indigo-500/40 text-white"
                            : "hover:bg-slate-900 text-slate-300 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-xs font-bold truncate">
                            Chương {ch.index}: {ch.title}
                          </span>
                          {ch.isGenerated && (
                            <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                              AI Ready
                            </span>
                          )}
                        </div>
                        {ch.startPage && ch.endPage && (
                          <p className="mt-0.5 text-[10px] text-slate-400">
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
                        <h3 className="text-base sm:text-lg font-bold text-white">
                          Chương {activeInspectChapter.index}:{" "}
                          {activeInspectChapter.title}
                        </h3>
                        <span
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                            activeInspectChapter.isGenerated
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {activeInspectChapter.isGenerated
                            ? "Đã có sẵn Bài giảng AI, Từ vựng & Bài tập"
                            : "Chứa văn bản gốc (Sẽ phân tích AI khi học)"}
                        </span>
                      </div>
                      {activeInspectChapter.summary && (
                        <p className="mt-1.5 text-xs text-slate-400">
                          {activeInspectChapter.summary}
                        </p>
                      )}
                    </div>

                    {/* Raw Text Excerpt Preview */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-indigo-300 uppercase tracking-wider">
                          Nội dung văn bản gốc trong chương ({activeInspectChapter.rawText?.length || 0} ký tự)
                        </span>
                      </div>
                      <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-3.5 text-xs leading-relaxed text-slate-300 whitespace-pre-wrap font-mono">
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
                        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
                          <p className="text-xs font-bold text-amber-300 mb-2">
                            Từ vựng có sẵn ({activeInspectChapter.lesson.vocabulary?.length || 0} từ)
                          </p>
                          <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {activeInspectChapter.lesson.vocabulary
                              ?.slice(0, 8)
                              .map((v) => (
                                <div
                                  key={v.id}
                                  className="flex items-center justify-between gap-2 text-xs border-b border-slate-800/60 pb-1"
                                >
                                  <span className="font-semibold text-white">
                                    {v.word}{" "}
                                    <span className="text-slate-400 font-normal">
                                      {v.ipa}
                                    </span>
                                  </span>
                                  <span className="text-slate-300 truncate max-w-[140px]">
                                    {v.vietnameseMeaning}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
                          <p className="text-xs font-bold text-emerald-300 mb-2">
                            Cấu trúc Ngữ pháp ({activeInspectChapter.lesson.grammarPoints?.length || 0} chủ điểm)
                          </p>
                          <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {activeInspectChapter.lesson.grammarPoints?.map(
                              (g) => (
                                <div
                                  key={g.id}
                                  className="text-xs border-b border-slate-800/60 pb-1.5"
                                >
                                  <p className="font-semibold text-white">
                                    {g.title}
                                  </p>
                                  <p className="text-[11px] text-indigo-300">
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
                  <p className="text-xs text-slate-400">
                    Sách này chưa có chương nào.
                  </p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-950 px-5 py-3.5">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>
                  Khi bấm Apply, sách sẽ được nhân bản độc lập vào tài khoản của bạn (không ảnh hưởng dữ liệu người đăng).
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setInspectingCourse(null)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
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
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2 text-xs font-bold text-white shadow cursor-pointer"
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
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/25 cursor-pointer disabled:opacity-50"
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

