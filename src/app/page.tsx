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
  ChevronDown,
  Timer,
  AlertCircle,
  Key,
  Mail,
  Crown,
  Zap,
  Infinity as InfinityIcon,
  Library,
} from "lucide-react";
import {
  Course,
  FlashcardSRS,
  StudyStreak,
  UserQuotaAccount,
  VirtualEmailItem,
} from "@/types/course";
import {
  getAllCourses,
  getLibraryCourses,
  applyLibraryCourseToUser,
  getCourseFlashcards,
  saveCourse,
  deleteCourse,
  getAppSettings,
  getCurrentUser,
  setCachedAuthenticatedUser,
  signInWithGoogle,
  signOutUser,
  getStudyStreak,
  syncAttendanceWithSupabase,
  pullSystemAiKeysFromCloud,
  getSupabaseClient,
  AppUser,
} from "@/lib/storage";
import {
  getUserQuotaAccount,
  ensureUserQuotaProvisioned,
  syncAndVerifyAdminRoleFromSupabase,
  getVirtualEmails,
  PLAN_CONFIG,
} from "@/lib/quotaManager";
import { stopAllSpeech } from "@/lib/tts";
import { runWithFeedback, showToast } from "@/lib/feedback";
import CreateCourseModal from "@/components/CreateCourseModal";
import SettingsModal from "@/components/SettingsModal";
import ChapterWorkspace from "@/components/ChapterWorkspace";
import FlashcardArena from "@/components/FlashcardArena";
import ExamArena from "@/components/ExamArena";
import AttendanceDashboard from "@/components/AttendanceDashboard";
import BookLibraryView from "@/components/BookLibraryView";
import LoginScreen from "@/components/LoginScreen";
import CustomSelect from "@/components/ui/CustomSelect";
import UpgradePlanModal from "@/components/UpgradePlanModal";
import EmailInboxModal from "@/components/EmailInboxModal";

export default function HomePage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [libraryCourses, setLibraryCourses] = useState<Course[]>([]);
  const [flashcards, setFlashcards] = useState<FlashcardSRS[]>([]);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<
    "dashboard" | "library" | "srs_global" | "attendance"
  >("attendance");
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [streakData, setStreakData] = useState<StudyStreak>({
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: "",
    activeDates: [],
  });
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [avatarImgError, setAvatarImgError] = useState(false);
  const [reviewCourseId, setReviewCourseId] = useState<string>("");
  const [reviewChapterId, setReviewChapterId] = useState<string>("");
  const [reviewSubTab, setReviewSubTab] = useState<"exam" | "flashcards">(
    "exam"
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isInboxModalOpen, setIsInboxModalOpen] = useState(false);
  const [prefillKeyForModal, setPrefillKeyForModal] = useState("");
  const [quotaAccount, setQuotaAccount] = useState<UserQuotaAccount | null>(
    null
  );
  const [unreadEmailCount, setUnreadEmailCount] = useState(0);
  const [newEmailToast, setNewEmailToast] = useState<VirtualEmailItem | null>(
    null
  );
  const [hasApiKey, setHasApiKey] = useState(false);
  const [hasCloudSync, setHasCloudSync] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refreshData = useCallback(async () => {
    const user = await getCurrentUser();
    const [loadedCourses, loadedCards, loadedLibrary, attendanceRes] =
      await Promise.all([
        getAllCourses(),
        getCourseFlashcards(),
        getLibraryCourses(),
        syncAttendanceWithSupabase(),
        pullSystemAiKeysFromCloud(),
      ]);
    setCourses(loadedCourses);
    setFlashcards(loadedCards);
    setLibraryCourses(loadedLibrary);
    setCurrentUser((prev) => {
      if (prev?.id !== user?.id) {
        setAvatarImgError(false);
      }
      return user;
    });
    setStreakData(attendanceRes.streak || getStudyStreak());

    if (user) {
      let qAcc = getUserQuotaAccount(user);
      if (!qAcc) {
        const provisioned = await ensureUserQuotaProvisioned(user);
        qAcc = provisioned.account;
      }
      await syncAndVerifyAdminRoleFromSupabase(user);
      qAcc = getUserQuotaAccount(user) || qAcc;
      setQuotaAccount(qAcc);
      const userEmails = getVirtualEmails(user.email);
      setUnreadEmailCount(userEmails.filter((e) => !e.isRead).length);
      setHasApiKey(Boolean(qAcc?.isKeyActivated && qAcc?.activatedApiKey));
    } else {
      setQuotaAccount(null);
      setUnreadEmailCount(0);
      setHasApiKey(false);
    }

    const s = getAppSettings();
    setHasCloudSync(Boolean(s.supabaseUrl && s.supabaseAnonKey));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshData();

    // Stop speech when changing views or unmounting
    stopAllSpeech();

    // Listen to Supabase auth events (handle Google OAuth redirect & sign-out cleanly without polling)
    const supabase = getSupabaseClient();
    if (supabase) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "TOKEN_REFRESHED") {
          if (session?.user) {
            setCachedAuthenticatedUser(session.user as unknown as AppUser);
          }
          return;
        }
        if (event === "SIGNED_OUT") {
          setCachedAuthenticatedUser(null);
          setCurrentUser(null);
          setQuotaAccount(null);
          setCourses([]);
          setFlashcards([]);
          return;
        }
        if (session?.user) {
          const authUser = session.user as unknown as AppUser;
          setCachedAuthenticatedUser(authUser);
          setCurrentUser((prev) => {
            if (prev?.id === authUser.id) return prev;
            void refreshData();
            return authUser;
          });
        }
      });
      return () => subscription.unsubscribe();
    }
  }, [refreshData]);

  // Stop all speech whenever user switches views or courses
  useEffect(() => {
    stopAllSpeech();
  }, [viewMode, activeCourseId]);

  // Listen to quota & virtual email events (lightweight local state updates ONLY — zero extra API/DB calls)
  useEffect(() => {
    const syncLocalQuotaAndInbox = async () => {
      const u = await getCurrentUser();
      if (!u) return;
      const qAcc = getUserQuotaAccount(u);
      if (qAcc) {
        setQuotaAccount({ ...qAcc });
        setHasApiKey(Boolean(qAcc.isKeyActivated && qAcc.activatedApiKey));
      }
      const userEmails = getVirtualEmails(u.email);
      setUnreadEmailCount(userEmails.filter((e) => !e.isRead).length);
    };

    const handleQuotaUpdated = () => {
      void syncLocalQuotaAndInbox();
    };
    const handleEmailUpdated = () => {
      void syncLocalQuotaAndInbox();
    };
    const handleNewEmail = (e: Event) => {
      const customEvt = e as CustomEvent<VirtualEmailItem>;
      if (customEvt.detail) {
        setNewEmailToast(customEvt.detail);
        setTimeout(() => {
          setNewEmailToast((prev) =>
            prev?.id === customEvt.detail.id ? null : prev
          );
        }, 2000);
      }
      void syncLocalQuotaAndInbox();
    };
    const handleRequireKeyActivation = () => {
      setIsUpgradeModalOpen(true);
    };
    const handleQuotaExceeded = () => {
      setIsUpgradeModalOpen(true);
    };
    const handleSessionExpired = () => {
      stopAllSpeech();
      setActiveCourseId(null);
      setIsUpgradeModalOpen(false);
      setIsSettingsOpen(false);
      setIsInboxModalOpen(false);
      setCurrentUser(null);
      setQuotaAccount(null);
    };
    const handleAttendanceUpdated = (e: Event) => {
      const evt = e as CustomEvent<{ streak?: StudyStreak }>;
      setStreakData(evt.detail?.streak || getStudyStreak());
    };

    window.addEventListener("bookmind:quota-updated", handleQuotaUpdated);
    window.addEventListener("bookmind:email-updated", handleEmailUpdated);
    window.addEventListener("bookmind:new-email", handleNewEmail);
    window.addEventListener(
      "bookmind:require-key-activation",
      handleRequireKeyActivation
    );
    window.addEventListener("bookmind:quota-exceeded", handleQuotaExceeded);
    window.addEventListener("bookmind:session-expired", handleSessionExpired);
    window.addEventListener(
      "bookmind:attendance-updated",
      handleAttendanceUpdated
    );

    return () => {
      window.removeEventListener("bookmind:quota-updated", handleQuotaUpdated);
      window.removeEventListener("bookmind:email-updated", handleEmailUpdated);
      window.removeEventListener("bookmind:new-email", handleNewEmail);
      window.removeEventListener(
        "bookmind:require-key-activation",
        handleRequireKeyActivation
      );
      window.removeEventListener(
        "bookmind:quota-exceeded",
        handleQuotaExceeded
      );
      window.removeEventListener(
        "bookmind:session-expired",
        handleSessionExpired
      );
      window.removeEventListener(
        "bookmind:attendance-updated",
        handleAttendanceUpdated
      );
    };
  }, []);

  // Handle click outside to close user dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("#user-profile-menu")) {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) {
      window.addEventListener("click", handleClickOutside);
      return () => window.removeEventListener("click", handleClickOutside);
    }
  }, [isUserMenuOpen]);

  const handleLogout = async () => {
    if (confirm("Bạn có chắc chắn muốn đăng xuất tài khoản?")) {
      stopAllSpeech();
      setIsUserMenuOpen(false);
      setActiveCourseId(null);
      setIsSettingsOpen(false);
      setIsUpgradeModalOpen(false);
      setIsInboxModalOpen(false);
      await signOutUser();
      setCurrentUser(null);
      setQuotaAccount(null);
      setCourses([]);
      setFlashcards([]);
    }
  };

  const activeCourse = courses.find((c) => c.id === activeCourseId) || null;

  const dueFlashcards = flashcards.filter(
    (f) => new Date(f.nextReviewDate).getTime() <= Date.now()
  );

  const handleDeleteCourse = async (courseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetCourse = courses.find((c) => c.id === courseId);
    if (
      !window.confirm(
        "Bạn có chắc chắn muốn xóa Khóa học (Course) này và các thẻ Flashcard đi kèm?"
      )
    ) {
      return;
    }
    await runWithFeedback(
      {
        variant: "delete",
        loadingTitle: `Đang xóa "${targetCourse?.title || "Khóa học"}"...`,
        loadingSubtitle: "Đang dọn dẹp thẻ Flashcard và dữ liệu Cloud",
        successTitle: "Đã xóa khóa học thành công!",
        successMessage: targetCourse?.title,
      },
      async () => {
        await deleteCourse(courseId);
        if (activeCourseId === courseId) {
          setActiveCourseId(null);
        }
        await refreshData();
      }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-300">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-500/25 animate-pulse mb-4">
          <BookOpen className="h-7 w-7" />
        </div>
        <p className="text-sm font-semibold text-white">BookMind AI</p>
        <p className="mt-1 text-xs text-slate-400">Đang chuẩn bị không gian học tập...</p>
      </div>
    );
  }

  // AUTH GATE: Bắt buộc đăng nhập trước khi vào trang (Không hiển thị nút Cài đặt ở màn hình Login)
  if (!currentUser) {
    return (
      <LoginScreen
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          refreshData();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#090D16] pb-20 lg:pb-0">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#090D16]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between gap-2 px-3.5 sm:px-6">
          {/* Left: Brand Logo & Optional Breadcrumb */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                setActiveCourseId(null);
                setViewMode("dashboard");
              }}
              className="group flex items-center gap-2 sm:gap-2.5 text-left transition cursor-pointer shrink-0"
            >
              <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 group-hover:bg-indigo-500 transition">
                <BookOpen className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm sm:text-base font-bold tracking-tight text-white">
                  BookMind
                </span>
                <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold tracking-wider text-indigo-300 border border-white/[0.08]">
                  STUDIO
                </span>
              </div>
            </button>

            {/* Context breadcrumb when viewing a course */}
            {activeCourse && (
              <div className="hidden md:flex items-center gap-2 pl-3 ml-1 border-l border-white/[0.08] text-xs min-w-0">
                <span className="text-slate-600">/</span>
                <span className="max-w-[200px] lg:max-w-[260px] truncate text-slate-300 font-medium">
                  {activeCourse.title}
                </span>
              </div>
            )}
          </div>

          {/* Center: Clean Editorial Segmented Navigation Bar (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1 p-1 rounded-xl bg-[#0F1523] border border-white/[0.07] shrink-0">
            {/* 1. Điểm danh */}
            <button
              type="button"
              onClick={() => {
                setActiveCourseId(null);
                setViewMode("attendance");
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
                !activeCourseId && viewMode === "attendance"
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <Flame className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span>Điểm danh</span>
              <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                {streakData.currentStreak}d
              </span>
            </button>

            {/* 2. Tủ sách cá nhân */}
            <button
              type="button"
              onClick={() => {
                setActiveCourseId(null);
                setViewMode("dashboard");
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
                !activeCourseId && viewMode === "dashboard"
                  ? "bg-white/[0.08] text-white border border-white/[0.1]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
              <span>Tủ sách</span>
              <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-300 font-semibold">
                {courses.length}
              </span>
            </button>

            {/* 3. Thư viện sách cộng đồng */}
            <button
              type="button"
              onClick={() => {
                setActiveCourseId(null);
                setViewMode("library");
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
                !activeCourseId && viewMode === "library"
                  ? "bg-white/[0.08] text-white border border-white/[0.1]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <Library className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Thư viện</span>
              <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300 font-semibold">
                {libraryCourses.length}
              </span>
            </button>

            {/* 4. Ôn tập & Thi */}
            <button
              type="button"
              onClick={() => {
                setActiveCourseId(null);
                setViewMode("srs_global");
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
                !activeCourseId && viewMode === "srs_global"
                  ? "bg-white/[0.08] text-white border border-white/[0.1]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <GraduationCap className="h-3.5 w-3.5 text-indigo-300 shrink-0" />
              <span>Ôn tập &amp; Thi</span>
              {dueFlashcards.length > 0 && (
                <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                  {dueFlashcards.length}
                </span>
              )}
            </button>
          </nav>

          {/* Right: Unified Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {/* Quota & Plan Upgrade Pill */}
            <button
              type="button"
              onClick={() => setIsUpgradeModalOpen(true)}
              className={`flex items-center gap-1 sm:gap-1.5 rounded-xl border px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold transition cursor-pointer shrink-0 ${
                quotaAccount &&
                quotaAccount.plan !== "unlimited" &&
                quotaAccount.maxCalls !== -1 &&
                quotaAccount.usedCalls >= quotaAccount.maxCalls
                  ? "border-rose-500/50 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 animate-pulse"
                  : quotaAccount?.plan === "unlimited"
                  ? "border-purple-500/40 bg-purple-500/15 text-purple-300 hover:bg-purple-500/25"
                  : quotaAccount?.plan === "pro"
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                  : "border-indigo-500/30 bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25"
              }`}
              title="Xem số dư AI Credit hôm nay, bảng quy đổi 1-5 Credit & nâng cấp gói"
            >
              {quotaAccount?.plan === "unlimited" ? (
                <>
                  <InfinityIcon className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                  <span className="sm:hidden">VIP</span>
                  <span className="hidden sm:inline">
                    VIP: {quotaAccount.usedCalls}/{quotaAccount.fupDailyLimit || 500} Credit
                  </span>
                </>
              ) : quotaAccount &&
                quotaAccount.maxCalls !== -1 &&
                quotaAccount.usedCalls >= quotaAccount.maxCalls ? (
                <>
                  <Zap className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                  <span className="sm:hidden">Hết Credit</span>
                  <span className="hidden sm:inline">
                    Hết Credit ({quotaAccount.usedCalls}/{quotaAccount.maxCalls}) • Nâng cấp
                  </span>
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span className="sm:hidden">
                    {quotaAccount?.usedCalls ?? 0}/{quotaAccount?.maxCalls ?? 30}
                  </span>
                  <span className="hidden sm:inline">
                    {PLAN_CONFIG[quotaAccount?.plan || "free"].shortBadge}:{" "}
                    {quotaAccount?.usedCalls ?? 0}/{quotaAccount?.maxCalls ?? 30} Credit
                  </span>
                </>
              )}
            </button>

            {/* Email Inbox Icon Button */}
            <button
              type="button"
              onClick={() => {
                setNewEmailToast(null);
                setIsInboxModalOpen(true);
              }}
              className="relative flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition shadow-sm cursor-pointer"
              title="Hộp thư Email nhận Mã BookMind API Key"
            >
              <Mail className="h-4 w-4 text-indigo-400" />
              {unreadEmailCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white shadow">
                  {unreadEmailCount}
                </span>
              )}
            </button>

            {/* Create New Course Button */}
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="hidden sm:flex items-center gap-1.5 shrink-0 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition active:scale-95 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span>Nạp sách mới</span>
            </button>

            {/* Settings Icon Button (Hidden on tiny screens since it's in the User menu) */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="hidden sm:flex relative h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition shadow-sm cursor-pointer"
              title="Cài đặt Gemini API & Supabase Cloud"
            >
              <Settings className="h-4 w-4" />
              <span
                className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full ${
                  hasApiKey ? "bg-emerald-400" : "bg-amber-400 ring-2 ring-slate-900"
                }`}
              />
            </button>

            {/* User Profile Menu Dropdown */}
            <div id="user-profile-menu" className="relative shrink-0">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-1 sm:gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 p-1 pr-1.5 sm:pr-2 hover:border-slate-700 hover:bg-slate-800 transition cursor-pointer"
                title="Tài khoản của bạn"
              >
                {currentUser?.user_metadata?.avatar_url && !avatarImgError ? (
                  <img
                    src={currentUser.user_metadata.avatar_url}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarImgError(true)}
                    className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg object-cover ring-1 ring-indigo-500/50 shrink-0"
                  />
                ) : (
                  <div className="flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-bold text-xs shadow-sm">
                    {currentUser?.user_metadata?.full_name
                      ? currentUser.user_metadata.full_name.charAt(0).toUpperCase()
                      : currentUser?.email?.charAt(0).toUpperCase() || "U"}
                  </div>
                )}
                <span className="hidden md:inline max-w-[90px] truncate text-xs font-semibold text-slate-200">
                  {currentUser?.user_metadata?.full_name ||
                    currentUser?.email?.split("@")[0] ||
                    "Học viên"}
                </span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {/* Dropdown Popover */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] max-w-[16.5rem] rounded-2xl border border-slate-800 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2.5 border-b border-slate-800/80">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-white truncate">
                        {currentUser?.user_metadata?.full_name || "Học viên BookMind"}
                      </p>
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${
                          quotaAccount?.role === "admin"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-slate-800 text-slate-300 border border-slate-700"
                        }`}
                      >
                        {quotaAccount?.role === "admin" ? "Admin" : "User"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {currentUser?.email || "Chế độ lưu cục bộ"}
                    </p>
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {currentUser?.app_metadata?.provider === "local"
                        ? "Học viên Offline / IndexedDB"
                        : "Đã liên kết Cloud"}
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setActiveCourseId(null);
                        setViewMode("attendance");
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition text-left cursor-pointer"
                    >
                      <Flame className="h-3.5 w-3.5 text-amber-400" />
                      <span>Nhật ký & Chuỗi học ({streakData.currentStreak} ngày)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsUpgradeModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition text-left cursor-pointer"
                    >
                      <Crown className="h-3.5 w-3.5 text-amber-400" />
                      <span>Gói AI Credit & Nâng cấp (30 / 120 / VIP)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsInboxModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition text-left cursor-pointer"
                    >
                      <Mail className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Hộp thư thông báo tài khoản</span>
                    </button>

                    {quotaAccount?.role === "admin" && (
                      <a
                        href="/admin"
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-amber-300 hover:bg-amber-950/40 hover:text-amber-200 transition text-left cursor-pointer font-semibold"
                      >
                        <Key className="h-3.5 w-3.5 text-amber-400" />
                        <span>Trang Quản Trị Admin (/admin)</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsSettingsOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition text-left cursor-pointer"
                    >
                      <Settings className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Cài đặt Mô hình AI & Sao lưu</span>
                    </button>
                  </div>

                  <div className="border-t border-slate-800/80 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition text-left cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Đăng xuất tài khoản</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
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
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-300">
                      <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
                      <span>1. Chọn Khóa Học (Course)</span>
                    </label>
                    <CustomSelect
                      value={targetCourse.id}
                      onChange={(newVal) => {
                        const newC = courses.find((c) => c.id === newVal);
                        setReviewCourseId(newVal);
                        setReviewChapterId(newC?.chapters[0]?.id || "");
                      }}
                      accentColor="indigo"
                      icon={<BookOpen className="h-3.5 w-3.5" />}
                      options={courses.map((c) => ({
                        value: c.id,
                        label: c.title,
                        subLabel: `${c.chapters.length} chương • CEFR ${c.level}`,
                        badge: `${c.chapters.length} ch`,
                      }))}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-300">
                      <Layers className="h-3.5 w-3.5 text-emerald-400" />
                      <span>2. Chọn Chương Cần Kiểm Tra / Ôn Tập</span>
                    </label>
                    <CustomSelect
                      value={targetChapter?.id || ""}
                      onChange={(newVal) => setReviewChapterId(newVal)}
                      accentColor="emerald"
                      icon={<Layers className="h-3.5 w-3.5" />}
                      options={targetCourse.chapters.map((ch) => ({
                        value: ch.id,
                        label: `Chương ${ch.index}: ${ch.title}`,
                        subLabel:
                          ch.startPage && ch.endPage
                            ? `Trang ${ch.startPage}–${ch.endPage}`
                            : undefined,
                        badge: ch.isGenerated ? "Đã soạn" : "Chưa soạn",
                      }))}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                      <span>3. Chế độ</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setReviewSubTab("exam")}
                        className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-3 text-xs font-bold transition cursor-pointer ${
                          reviewSubTab === "exam"
                            ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-600/20"
                            : "border border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-900 hover:text-white"
                        }`}
                      >
                        <Timer className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Thi Kiểm Tra</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setReviewSubTab("flashcards")}
                        className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-3 text-xs font-bold transition cursor-pointer ${
                          reviewSubTab === "flashcards"
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                            : "border border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-900 hover:text-white"
                        }`}
                      >
                        <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          Flashcard ({scopedFlashcards.length})
                        </span>
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
      ) : viewMode === "library" ? (
        <BookLibraryView
          libraryCourses={libraryCourses}
          myCourses={courses}
          currentUser={currentUser}
          onApplyCourse={async (libCourse) => {
            const added = await applyLibraryCourseToUser(libCourse);
            await refreshData();
            return added;
          }}
          onOpenMyCourse={(courseId) => {
            setActiveCourseId(courseId);
            setViewMode("dashboard");
          }}
          onRefreshLibrary={async () => {
            const freshLib = await getLibraryCourses(true);
            setLibraryCourses(freshLib);
          }}
          onOpenCreateModal={() => setIsCreateOpen(true)}
        />
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
        <div className="mx-auto w-full max-w-7xl flex-1 px-3.5 py-5 sm:px-6 sm:py-8">
          {/* Top Stats Banner (2-col on mobile, 4-col on desktop) */}
          <div className="mb-6 sm:mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/[0.07] bg-[#0F1523]/90 p-4 sm:p-5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Tủ Sách Cá Nhân</span>
                <BookOpen className="h-4 w-4 text-indigo-400 shrink-0" />
              </div>
              <div className="mt-1.5 text-xl sm:text-2xl font-bold text-white">
                {courses.length}{" "}
                <span className="text-xs font-normal text-slate-400">cuốn</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400 truncate">
                Lộ trình học tập độc lập
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-[#0F1523]/90 p-4 sm:p-5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Chương Đã Soạn</span>
                <Layers className="h-4 w-4 text-emerald-400 shrink-0" />
              </div>
              <div className="mt-1.5 text-xl sm:text-2xl font-bold text-white">
                {courses.reduce(
                  (acc, c) =>
                    acc + c.chapters.filter((ch) => ch.isGenerated).length,
                  0
                )}{" "}
                <span className="text-sm font-normal text-slate-500">
                  / {courses.reduce((acc, c) => acc + c.chapters.length, 0)}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400 truncate">
                Phân tích sâu &amp; Bài tập
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-[#0F1523]/90 p-4 sm:p-5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Kho Từ Vựng SRS</span>
                <GraduationCap className="h-4 w-4 text-amber-400 shrink-0" />
              </div>
              <div className="mt-1.5 text-xl sm:text-2xl font-bold text-white">
                {flashcards.length}{" "}
                <span className="text-xs font-normal text-slate-400">từ</span>
              </div>
              <div className="mt-1 text-[11px] text-amber-300/90 truncate">
                {dueFlashcards.length} thẻ đến hạn hôm nay
              </div>
            </div>

            <div
              onClick={() => setIsUpgradeModalOpen(true)}
              className="rounded-2xl border border-white/[0.07] bg-[#0F1523]/90 p-4 sm:p-5 cursor-pointer hover:border-indigo-500/40 transition"
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Gói AI Credit</span>
                <Crown className="h-4 w-4 text-amber-400 shrink-0" />
              </div>
              <div className="mt-1.5 text-sm sm:text-base font-bold text-white truncate">
                {quotaAccount
                  ? PLAN_CONFIG[quotaAccount.plan].name
                  : "Gói Free (30 Credit)"}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
                {quotaAccount?.isKeyActivated ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span className="text-emerald-300 truncate">
                      {quotaAccount.plan === "unlimited"
                        ? `Đã dùng ${quotaAccount.usedCalls} • VIP`
                        : `${quotaAccount.usedCalls}/${quotaAccount.maxCalls} Credit`}
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
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
                onClick={() => setViewMode("library")}
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
                    onClick={() => setActiveCourseId(course.id)}
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
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCourse(course.id, e)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/15 hover:text-rose-400 transition"
                          title="Xóa khóa học"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
                onClick={() => setViewMode("library")}
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
      )}

      {/* Floating Account Confirmation Toast */}
      {newEmailToast && (
        <div className="fixed bottom-5 right-5 z-40 max-w-sm rounded-2xl border border-emerald-500/50 bg-slate-900/95 p-4 shadow-2xl shadow-emerald-950/80 backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-extrabold text-white">
                  {newEmailToast.paymentMethod === "momo" ||
                  newEmailToast.paymentMethod === "vnpay"
                    ? "Đã nâng cấp gói AI thành công!"
                    : "Đăng ký tài khoản thành công!"}
                </p>
                <p className="text-[11px] text-slate-400 truncate max-w-[210px]">
                  Tài khoản: {newEmailToast.toEmail}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setNewEmailToast(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Đóng
            </button>
          </div>
          <div className="mt-2.5 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-emerald-300 text-center font-semibold">
            Đã tự động kích hoạt {PLAN_CONFIG[newEmailToast.plan].name}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setNewEmailToast(null);
                setIsInboxModalOpen(true);
              }}
              className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2 text-xs font-bold text-white transition cursor-pointer"
            >
              Xem thông báo
            </button>
            <button
              type="button"
              onClick={() => {
                setNewEmailToast(null);
                setIsUpgradeModalOpen(true);
              }}
              className="rounded-xl border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 px-3 py-2 text-xs font-bold text-amber-300 transition cursor-pointer"
            >
              Chi tiết gói
            </button>
          </div>
        </div>
      )}

      {/* Mobile Fixed Bottom Navigation Bar (UI/UX Pro Max Mobile-First) */}
      <nav
        aria-label="Điều hướng di động"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-white/[0.08] bg-[#090D16]/95 backdrop-blur-xl pb-safe lg:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 items-center px-1.5 pt-1.5 pb-1">
          <button
            type="button"
            onClick={() => {
              setActiveCourseId(null);
              setViewMode("attendance");
            }}
            className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[10px] font-semibold transition ${
              !activeCourseId && viewMode === "attendance"
                ? "text-amber-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="relative flex items-center justify-center">
              <Flame className="h-4 w-4" />
              {streakData.currentStreak > 0 && (
                <span className="ml-0.5 text-[9px] font-extrabold text-amber-300">
                  {streakData.currentStreak}
                </span>
              )}
            </div>
            <span>Điểm danh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCourseId(null);
              setViewMode("dashboard");
            }}
            className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[10px] font-semibold transition ${
              !activeCourseId && viewMode === "dashboard"
                ? "text-indigo-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span>Tủ sách ({courses.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex min-h-[44px] flex-col items-center justify-center gap-0.5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30 active:scale-95 transition">
              <Plus className="h-4.5 w-4.5" />
            </div>
            <span className="text-[10px] font-semibold text-indigo-300">
              Nạp sách
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCourseId(null);
              setViewMode("library");
            }}
            className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[10px] font-semibold transition ${
              !activeCourseId && viewMode === "library"
                ? "text-emerald-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Library className="h-4 w-4" />
            <span>Thư viện</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCourseId(null);
              setViewMode("srs_global");
            }}
            className={`relative flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[10px] font-semibold transition ${
              !activeCourseId && viewMode === "srs_global"
                ? "text-indigo-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="relative">
              <GraduationCap className="h-4 w-4" />
              {dueFlashcards.length > 0 && (
                <span className="absolute -right-2.5 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-amber-500 px-1 text-[8px] font-black text-slate-950">
                  {dueFlashcards.length}
                </span>
              )}
            </div>
            <span>Ôn &amp; Thi</span>
          </button>
        </div>
      </nav>

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

      <UpgradePlanModal
        isOpen={isUpgradeModalOpen}
        onClose={() => {
          setIsUpgradeModalOpen(false);
          setPrefillKeyForModal("");
        }}
        currentUser={currentUser}
        quotaAccount={quotaAccount}
        initialPrefillKey={prefillKeyForModal}
        onOpenInbox={() => setIsInboxModalOpen(true)}
        onQuotaChanged={refreshData}
      />

      <EmailInboxModal
        isOpen={isInboxModalOpen}
        onClose={() => setIsInboxModalOpen(false)}
        currentUser={currentUser}
        quotaAccount={quotaAccount}
        onOpenActivateModal={(prefillKey) => {
          if (prefillKey) setPrefillKeyForModal(prefillKey);
          setIsUpgradeModalOpen(true);
        }}
      />
    </div>
  );
}
