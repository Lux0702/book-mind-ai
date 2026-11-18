"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";
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
  getCourseFlashcards,
  deleteCourse,
  isCourseOwnedByUser,
  getAppSettings,
  getCurrentUser,
  setCachedAuthenticatedUser,
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
} from "@/lib/quotaManager";
import { stopAllSpeech } from "@/lib/tts";
import { runWithFeedback, showToast } from "@/lib/feedback";
import { ROUTES } from "@/lib/routes";
import LoginScreen from "@/components/LoginScreen";

export interface AppDataContextValue {
  courses: Course[];
  libraryCourses: Course[];
  setLibraryCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  flashcards: FlashcardSRS[];
  dueFlashcards: FlashcardSRS[];
  currentUser: AppUser | null;
  streakData: StudyStreak;
  quotaAccount: UserQuotaAccount | null;
  hasApiKey: boolean;
  unreadEmailCount: number;
  isLoading: boolean;
  refreshData: () => Promise<void>;
  handleDeleteCourse: (courseId: string, e: React.MouseEvent) => Promise<void>;
  handleLogout: () => Promise<void>;

  // Modal & toast state dùng chung cho toàn bộ ứng dụng
  isCreateOpen: boolean;
  setIsCreateOpen: (open: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  isUpgradeModalOpen: boolean;
  setIsUpgradeModalOpen: (open: boolean) => void;
  isInboxModalOpen: boolean;
  setIsInboxModalOpen: (open: boolean) => void;
  prefillKeyForModal: string;
  setPrefillKeyForModal: (key: string) => void;
  newEmailToast: VirtualEmailItem | null;
  setNewEmailToast: React.Dispatch<React.SetStateAction<VirtualEmailItem | null>>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error("useAppData phải được dùng bên trong <AppDataProvider>");
  }
  return ctx;
}

export default function AppDataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [courses, setCourses] = useState<Course[]>([]);
  const [libraryCourses, setLibraryCourses] = useState<Course[]>([]);
  const [flashcards, setFlashcards] = useState<FlashcardSRS[]>([]);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [streakData, setStreakData] = useState<StudyStreak>({
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: "",
    activeDates: [],
  });
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
    setCurrentUser(user);
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

  // Dừng đọc khi chuyển trang
  useEffect(() => {
    stopAllSpeech();
  }, [pathname]);
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
      router.replace(ROUTES.home);
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

  const handleLogout = async () => {
    if (confirm("Bạn có chắc chắn muốn đăng xuất tài khoản?")) {
      stopAllSpeech();
      setIsSettingsOpen(false);
      setIsUpgradeModalOpen(false);
      setIsInboxModalOpen(false);
      await signOutUser();
      setCurrentUser(null);
      setQuotaAccount(null);
      setCourses([]);
      setFlashcards([]);
      router.replace(ROUTES.home);
    }
  };

  const dueFlashcards = flashcards.filter(
    (f) => new Date(f.nextReviewDate).getTime() <= Date.now()
  );
  const handleDeleteCourse = async (courseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetCourse =
      courses.find((c) => c.id === courseId) ||
      libraryCourses.find((c) => c.id === courseId);

    const isAppliedCopy = Boolean(targetCourse?.clonedFromCourseId);
    const isUploader = targetCourse
      ? isCourseOwnedByUser(targetCourse, currentUser)
      : false;

    if (!isAppliedCopy && targetCourse && !isUploader) {
      showToast({
        type: "error",
        title: "Không có quyền xóa sách gốc",
        message: "Chỉ người tải sách này lên mới có quyền xóa sách gốc.",
      });
      return;
    }

    const confirmMsg = isAppliedCopy
      ? "Bạn có muốn gỡ sách này khỏi Tủ sách cá nhân? (Sách gốc trên Thư viện Cộng đồng vẫn được giữ nguyên)"
      : "Bạn là người tải cuốn sách này lên. Xóa sách sẽ xóa vĩnh viễn khỏi cả Tủ sách và Thư viện Cộng đồng. Bạn có chắc chắn muốn xóa?";

    if (!window.confirm(confirmMsg)) {
      return;
    }

    await runWithFeedback(
      {
        variant: "delete",
        loadingTitle: isAppliedCopy
          ? `Đang gỡ "${targetCourse?.title || "sách"}" khỏi Tủ sách cá nhân...`
          : `Đang xóa vĩnh viễn "${targetCourse?.title || "Khóa học"}"...`,
        loadingSubtitle: isAppliedCopy
          ? "Đang dọn dẹp bản sao cá nhân & thẻ Flashcard (Sách gốc vẫn giữ nguyên)"
          : "Đang xóa sách gốc, thẻ Flashcard và dữ liệu Cloud",
        successTitle: isAppliedCopy
          ? "Đã gỡ sách khỏi Tủ sách cá nhân!"
          : "Đã xóa sách gốc thành công!",
        successMessage: targetCourse?.title,
      },
      async () => {
        await deleteCourse(courseId);
        if (pathname.startsWith(ROUTES.book(courseId))) {
          router.push(ROUTES.books);
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
        <p className="mt-1 text-xs text-slate-400">
          Đang chuẩn bị không gian học tập...
        </p>
      </div>
    );
  }

  // AUTH GATE: Bắt buộc đăng nhập trước khi vào bất kỳ trang nào
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

  const value: AppDataContextValue = {
    courses,
    libraryCourses,
    setLibraryCourses,
    flashcards,
    dueFlashcards,
    currentUser,
    streakData,
    quotaAccount,
    hasApiKey,
    unreadEmailCount,
    isLoading,
    refreshData,
    handleDeleteCourse,
    handleLogout,
    isCreateOpen,
    setIsCreateOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isUpgradeModalOpen,
    setIsUpgradeModalOpen,
    isInboxModalOpen,
    setIsInboxModalOpen,
    prefillKeyForModal,
    setPrefillKeyForModal,
    newEmailToast,
    setNewEmailToast,
  };

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}