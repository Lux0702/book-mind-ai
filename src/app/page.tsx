"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Plus,
  Settings,
  Layers,
  Sparkles,
  Trash2,
  ArrowRight,
  GraduationCap,
  Clock,
  CheckCircle2,
  Database,
  FileText,
  Flame,
  LogIn,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { User } from "@supabase/supabase-js";
import { Course, FlashcardSRS, StudyStreak } from "@/types/course";
import {
  getAllCourses,
  getCourseFlashcards,
  saveCourse,
  deleteCourse,
  getAppSettings,
  getCurrentUser,
  signInWithGoogle,
  signOutUser,
  getStudyStreak,
  getSupabaseClient,
} from "@/lib/storage";
import CreateCourseModal from "@/components/CreateCourseModal";
import SettingsModal from "@/components/SettingsModal";
import ChapterWorkspace from "@/components/ChapterWorkspace";
import FlashcardArena from "@/components/FlashcardArena";
import ExamArena from "@/components/ExamArena";
import AttendanceDashboard from "@/components/AttendanceDashboard";

export default function HomePage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [flashcards, setFlashcards] = useState<FlashcardSRS[]>([]);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<
    "dashboard" | "srs_global" | "attendance"
  >("dashboard");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [streakData, setStreakData] = useState<StudyStreak>({
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: "",
    activeDates: [],
  });
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [reviewCourseId, setReviewCourseId] = useState<string>("");
  const [reviewChapterId, setReviewChapterId] = useState<string>("");
  const [reviewSubTab, setReviewSubTab] = useState<"exam" | "flashcards">(
    "exam"
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [hasCloudSync, setHasCloudSync] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refreshData = useCallback(async () => {
    const [loadedCourses, loadedCards, user] = await Promise.all([
      getAllCourses(),
      getCourseFlashcards(),
      getCurrentUser(),
    ]);
    setCourses(loadedCourses);
    setFlashcards(loadedCards);
    setCurrentUser(user);
    setStreakData(getStudyStreak());

    const s = getAppSettings();
    setHasApiKey(Boolean(s.geminiApiKey?.trim()));
    setHasCloudSync(Boolean(s.supabaseUrl && s.supabaseAnonKey));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshData();

    // Listen to Supabase auth events
    const supabase = getSupabaseClient();
    if (supabase) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setCurrentUser(session?.user || null);
        refreshData();
      });
      return () => subscription.unsubscribe();
    }
  }, [refreshData]);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    const { error } = await signInWithGoogle();
    if (error) {
      alert(`Đăng nhập Google thất bại: ${error.message}`);
    }
    setIsLoggingIn(false);
  };

  const handleGoogleLogout = async () => {
    if (confirm("Bạn có chắc chắn muốn đăng xuất tài khoản?")) {
      await signOutUser();
      setCurrentUser(null);
      await refreshData();
    }
  };

  const activeCourse = courses.find((c) => c.id === activeCourseId) || null;

  const dueFlashcards = flashcards.filter(
    (f) => new Date(f.nextReviewDate).getTime() <= Date.now()
  );

  const handleDeleteCourse = async (courseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      !window.confirm(
        "Bạn có chắc chắn muốn xóa Khóa học (Course) này và các thẻ Flashcard đi kèm?"
      )
    ) {
      return;
    }
    await deleteCourse(courseId);
    if (activeCourseId === courseId) {
      setActiveCourseId(null);
    }
    await refreshData();
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setActiveCourseId(null);
                setViewMode("dashboard");
              }}
              className="flex items-center gap-2.5 text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/20">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <span className="text-base font-extrabold tracking-tight text-white">
                  BookMind <span className="text-indigo-400">AI</span>
                </span>
                <span className="block text-[11px] text-slate-400">
                  Mỗi cuốn sách là một Khóa học chuyên sâu
                </span>
              </div>
            </button>

            <nav className="ml-6 hidden items-center gap-1 md:flex">
              <button
                type="button"
                onClick={() => {
                  setActiveCourseId(null);
                  setViewMode("dashboard");
                }}
                className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                  !activeCourseId && viewMode === "dashboard"
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                }`}
              >
                📚 Tủ Sách / Courses ({courses.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveCourseId(null);
                  setViewMode("srs_global");
                }}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                  !activeCourseId && viewMode === "srs_global"
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                }`}
              >
                🗂️ Ôn tập & Thi theo Chương
                {dueFlashcards.length > 0 && (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                    {dueFlashcards.length} thẻ
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveCourseId(null);
                  setViewMode("attendance");
                }}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  !activeCourseId && viewMode === "attendance"
                    ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 shadow"
                    : "text-slate-400 hover:bg-slate-900 hover:text-amber-300"
                }`}
              >
                <Flame className="h-4 w-4 text-amber-400 animate-pulse" />
                <span>Điểm danh & Nhật ký ({streakData.currentStreak} ngày)</span>
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Google Authentication Status */}
            {currentUser ? (
              <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 py-1 pl-1.5 pr-2.5 text-xs">
                {currentUser.user_metadata?.avatar_url ? (
                  <img
                    src={currentUser.user_metadata.avatar_url}
                    alt={currentUser.user_metadata?.full_name || "User"}
                    className="h-7 w-7 rounded-lg object-cover ring-1 ring-amber-400"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold">
                    {currentUser.email?.slice(0, 1).toUpperCase() || "U"}
                  </div>
                )}
                <div className="hidden max-w-[120px] truncate sm:block">
                  <span className="block truncate font-bold text-slate-200">
                    {currentUser.user_metadata?.full_name ||
                      currentUser.email?.split("@")[0]}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleGoogleLogout}
                  className="ml-1 rounded-lg p-1 text-slate-400 hover:bg-rose-950/60 hover:text-rose-400"
                  title="Đăng xuất"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isLoggingIn}
                onClick={handleGoogleLogin}
                className="flex items-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-950/30 px-3.5 py-2 text-xs font-bold text-indigo-200 shadow transition hover:bg-indigo-900/50"
                title="Đăng nhập tài khoản Google để lưu trữ khóa học riêng biệt"
              >
                <LogIn className="h-3.5 w-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Đăng nhập Google</span>
                <span className="sm:hidden">Đăng nhập</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-700 hover:bg-slate-800"
            >
              <Settings className="h-4 w-4 text-indigo-400" />
              <span className="hidden sm:inline">Cài đặt API & Cloud</span>
              <span
                className={`h-2 w-2 rounded-full ${
                  hasApiKey ? "bg-emerald-400" : "bg-amber-400"
                }`}
                title={
                  hasApiKey
                    ? "Đã cấu hình Gemini API Key"
                    : "Chưa nhập Gemini API Key"
                }
              />
            </button>

            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/25 transition hover:from-indigo-500 hover:to-purple-500"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm Sách / Course mới</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      {activeCourse ? (
        <ChapterWorkspace
          course={activeCourse}
          flashcards={flashcards.filter((f) => f.courseId === activeCourse.id)}
          onBackToDashboard={() => setActiveCourseId(null)}
          onCourseUpdated={async () => {
            await refreshData();
          }}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      ) : viewMode === "srs_global" ? (
        /* Course & Chapter Scoped Review + Timed Exam Page */
        (() => {
          const targetCourse =
            courses.find((c) => c.id === reviewCourseId) || courses[0];
          const targetChapter =
            targetCourse?.chapters.find((ch) => ch.id === reviewChapterId) ||
            targetCourse?.chapters[0];
          const scopedFlashcards = flashcards.filter(
            (f) =>
              f.courseId === targetCourse?.id &&
              (!targetChapter || f.chapterId === targetChapter.id)
          );

          return (
            <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    Trung Tâm Kiểm Tra & Ôn Tập Theo Khóa Học / Chương
                  </h1>
                  <p className="mt-1 text-sm text-slate-400">
                    Chọn đúng Khóa học và Chương bạn muốn làm bài thi kiểm tra (có tính giờ từng câu) hoặc ôn Flashcard SRS.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewMode("dashboard")}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Quay về Tủ sách
                </button>
              </div>

              {/* Filter by Course -> Chapter */}
              {targetCourse && (
                <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 md:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-indigo-300">
                      1. Chọn Khóa Học (Course)
                    </label>
                    <select
                      value={targetCourse.id}
                      onChange={(e) => {
                        const newC = courses.find(
                          (c) => c.id === e.target.value
                        );
                        setReviewCourseId(e.target.value);
                        setReviewChapterId(newC?.chapters[0]?.id || "");
                      }}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs font-semibold text-white"
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          📚 {c.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-emerald-300">
                      2. Chọn Chương Cần Kiểm Tra / Ôn Tập
                    </label>
                    <select
                      value={targetChapter?.id || ""}
                      onChange={(e) => setReviewChapterId(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs font-semibold text-white"
                    >
                      {targetCourse.chapters.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          Chương {ch.index}: {ch.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-amber-300">
                      3. Chế độ
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setReviewSubTab("exam")}
                        className={`rounded-xl py-2.5 text-xs font-bold transition ${
                          reviewSubTab === "exam"
                            ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow"
                            : "bg-slate-950 text-slate-400 hover:text-white"
                        }`}
                      >
                        ⏱️ Thi Kiểm Tra Chương
                      </button>
                      <button
                        type="button"
                        onClick={() => setReviewSubTab("flashcards")}
                        className={`rounded-xl py-2.5 text-xs font-bold transition ${
                          reviewSubTab === "flashcards"
                            ? "bg-indigo-600 text-white shadow"
                            : "bg-slate-950 text-slate-400 hover:text-white"
                        }`}
                      >
                        🗂️ Thẻ Flashcard ({scopedFlashcards.length})
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {targetCourse && targetChapter && reviewSubTab === "exam" ? (
                <ExamArena
                  course={targetCourse}
                  currentChapter={targetChapter}
                  courseFlashcards={flashcards.filter(
                    (f) => f.courseId === targetCourse.id
                  )}
                />
              ) : (
                <FlashcardArena
                  cards={scopedFlashcards}
                  onCardsUpdated={refreshData}
                />
              )}
            </div>
          );
        })()
      ) : viewMode === "attendance" ? (
        <AttendanceDashboard
          courses={courses}
          flashcards={flashcards}
          onOpenCourse={(courseId) => {
            setActiveCourseId(courseId);
            setViewMode("dashboard");
          }}
          onOpenSrs={() => {
            setViewMode("srs_global");
          }}
        />
      ) : (
        /* DASHBOARD: All Courses Grid */
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
          {/* Top Stats Banner */}
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Tổng số Khóa học (Sách)</span>
                <BookOpen className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-white">
                {courses.length} Courses
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                Mỗi tài liệu là 1 lộ trình độc lập
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Chương sách đã phân tích</span>
                <Layers className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-white">
                {courses.reduce(
                  (acc, c) =>
                    acc + c.chapters.filter((ch) => ch.isGenerated).length,
                  0
                )}{" "}
                / {courses.reduce((acc, c) => acc + c.chapters.length, 0)}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                Diễn giải sâu + Ngữ pháp + Bài tập
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Kho Từ vựng & Flashcards</span>
                <GraduationCap className="h-4 w-4 text-amber-400" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-white">
                {flashcards.length} từ
              </div>
              <div className="mt-1 text-[11px] text-amber-300">
                {dueFlashcards.length} thẻ đến hạn ôn hôm nay
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Trạng thái Lưu trữ & AI</span>
                <Database className="h-4 w-4 text-sky-400" />
              </div>
              <div className="mt-2 text-sm font-bold text-white">
                {hasCloudSync
                  ? "IndexedDB + Supabase Cloud"
                  : "IndexedDB Local-First"}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {hasApiKey
                  ? "✅ Đã kết nối Gemini AI"
                  : "⚠️ Bấm Cài đặt để thêm Gemini Key"}
              </div>
            </div>
          </div>

          {/* Courses Section Header */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">
                Các Khóa Học Sách Của Bạn (My Courses)
              </h2>
              <p className="text-xs text-slate-400">
                Chọn một cuốn sách để vào học từng chương hoặc thêm sách PDF mới (hỗ trợ cả file PDF 80MB+ đọc trực tiếp)
              </p>
            </div>
          </div>

          {/* Courses Grid */}
          {isLoading ? (
            <div className="py-16 text-center text-sm text-slate-400">
              Đang tải dữ liệu các khóa học...
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                    onClick={() => setActiveCourseId(course.id)}
                    className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 shadow-lg transition hover:-translate-y-0.5 hover:border-indigo-500/60 hover:shadow-indigo-600/10"
                  >
                    {/* Card Top Banner */}
                    <div
                      className={`relative bg-gradient-to-r ${course.coverGradient} p-5`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="rounded-lg bg-black/30 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
                          CEFR {course.level}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCourse(course.id, e)}
                          className="rounded-lg bg-black/25 p-1.5 text-white/80 hover:bg-rose-600 hover:text-white"
                          title="Xóa khóa học"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <h3 className="mt-4 line-clamp-2 text-lg font-extrabold text-white">
                        {course.title}
                      </h3>
                      <p className="mt-1 text-xs font-medium text-white/85">
                        {course.author}
                      </p>
                    </div>

                    {/* Card Body */}
                    <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
                      <div className="space-y-3">
                        <p className="line-clamp-2 text-xs leading-relaxed text-slate-400">
                          {course.description}
                        </p>

                        <div className="flex flex-wrap gap-2 text-[11px]">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-slate-300">
                            <Layers className="h-3 w-3 text-indigo-400" />
                            {totalChapters} chương
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-slate-300">
                            <Sparkles className="h-3 w-3 text-amber-400" />
                            {courseCards.length} từ vựng
                          </span>
                          {course.sourceFileSizeMB && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-slate-300">
                              <FileText className="h-3 w-3 text-emerald-400" />
                              PDF {course.sourceFileSizeMB} MB
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3 pt-2">
                        {/* Progress bar */}
                        <div>
                          <div className="mb-1 flex justify-between text-[11px] text-slate-400">
                            <span>
                              Đã học {generatedChapters}/{totalChapters} chương
                            </span>
                            <span className="font-semibold text-indigo-300">
                              {totalCompletedEx} bài tập hoàn thành
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all"
                              style={{ width: `${Math.max(progressPct, 6)}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs font-bold text-indigo-400 group-hover:text-indigo-300">
                          <span>Mở Lộ trình & Vào học ngay</span>
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add New Course Card */}
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/30 p-6 text-center transition hover:border-indigo-500 hover:bg-slate-900/60"
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-400">
                  <Plus className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-white">
                  + Thêm Cuốn Sách / Tài Liệu Mới
                </h3>
                <p className="mt-1 max-w-xs text-xs text-slate-400">
                  Tải lên file PDF (kể cả sách 80MB+), TXT hoặc dán văn bản để AI tạo một Course độc lập
                </p>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <CreateCourseModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCourseCreated={async (newCourse) => {
          await saveCourse(newCourse);
          await refreshData();
          setActiveCourseId(newCourse.id);
        }}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsChanged={refreshData}
      />
    </div>
  );
}
