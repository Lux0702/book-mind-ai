"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Plus,
  Settings,
  Flame,
  ChevronDown,
  Mail,
  Crown,
  Zap,
  Infinity as InfinityIcon,
  Library,
  GraduationCap,
  Key,
  LogOut,
  CheckCircle2,
} from "lucide-react";
import { saveCourse } from "@/lib/storage";
import { PLAN_CONFIG } from "@/lib/quotaManager";
import { ROUTES } from "@/lib/routes";
import CreateCourseModal from "@/components/CreateCourseModal";
import SettingsModal from "@/components/SettingsModal";
import UpgradePlanModal from "@/components/UpgradePlanModal";
import EmailInboxModal from "@/components/EmailInboxModal";
import AngryPixelChibiGuard from "@/components/AngryPixelChibiGuard";
import { useAppData } from "./AppDataProvider";

type NavKey = "attendance" | "dashboard" | "library" | "srs_global";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ courseId?: string }>();
  const {
    courses,
    libraryCourses,
    dueFlashcards,
    currentUser,
    streakData,
    quotaAccount,
    hasApiKey,
    unreadEmailCount,
    refreshData,
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
  } = useAppData();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [avatarImgError, setAvatarImgError] = useState(false);

  useEffect(() => {
    setAvatarImgError(false);
  }, [currentUser?.id]);

  const courseIdFromUrl = params?.courseId
    ? decodeURIComponent(String(params.courseId))
    : null;
  const activeCourse = courseIdFromUrl
    ? courses.find((c) => c.id === courseIdFromUrl) || null
    : null;

  const isNavActive = (key: NavKey): boolean => {
    switch (key) {
      case "attendance":
        return pathname === ROUTES.home;
      case "dashboard":
        return pathname === ROUTES.books;
      case "library":
        return pathname.startsWith(ROUTES.library);
      case "srs_global":
        return pathname.startsWith(ROUTES.srs);
    }
  };
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

  return (
    <div className="min-h-screen flex flex-col bg-[#090D16] pb-20 lg:pb-0">      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#090D16]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between gap-2 px-3.5 sm:px-6">
          {/* Left: Brand Logo & Optional Breadcrumb */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                router.push(ROUTES.books);
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
            <Link
              href={ROUTES.home}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
                isNavActive("attendance")
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <Flame className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span>Điểm danh</span>
              <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                {streakData.currentStreak}d
              </span>
            </Link>

            {/* 2. Tủ sách cá nhân */}
            <Link
              href={ROUTES.books}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
                isNavActive("dashboard")
                  ? "bg-white/[0.08] text-white border border-white/[0.1]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
              <span>Tủ sách</span>
              <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-300 font-semibold">
                {courses.length}
              </span>
            </Link>

            {/* 3. Thư viện sách cộng đồng */}
            <Link
              href={ROUTES.library}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
                isNavActive("library")
                  ? "bg-white/[0.08] text-white border border-white/[0.1]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <Library className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Thư viện</span>
              <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300 font-semibold">
                {libraryCourses.length}
              </span>
            </Link>

            {/* 4. Ôn tập & Thi */}
            <Link
              href={ROUTES.srs}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
                isNavActive("srs_global")
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
            </Link>
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
                        router.push(ROUTES.home);
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

      {children}

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

      {/* Mobile Fixed Bottom Navigation Bar (Chỉ hiển thị ở màn hình chính; khi đang mở sách sẽ nhường chỗ cho Thanh 6 Tab Chương) */}
      {!activeCourse && (
        <nav
          aria-label="Điều hướng di động"
          className="fixed bottom-0 inset-x-0 z-40 border-t border-white/[0.08] bg-[#090D16]/95 backdrop-blur-xl pb-safe lg:hidden"
        >
          <div className="mx-auto grid max-w-lg grid-cols-5 items-center px-1.5 pt-1.5 pb-1">
            <Link
              href={ROUTES.home}
              className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[10px] font-semibold transition ${
                isNavActive("attendance")
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
            </Link>

            <Link
              href={ROUTES.books}
              className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[10px] font-semibold transition ${
                isNavActive("dashboard")
                  ? "text-indigo-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BookOpen className="h-4 w-4" />
              <span>Tủ sách ({courses.length})</span>
            </Link>

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

            <Link
              href={ROUTES.library}
              className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[10px] font-semibold transition ${
                isNavActive("library")
                  ? "text-emerald-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Library className="h-4 w-4" />
              <span>Thư viện</span>
            </Link>

            <Link
              href={ROUTES.srs}
              className={`relative flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[10px] font-semibold transition ${
                isNavActive("srs_global")
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
            </Link>
          </div>
        </nav>
      )}

      {/* Angry Pixel Chibi Guardian (khi bỏ lỡ điểm danh hôm qua & chưa điểm danh hôm nay) */}
      <AngryPixelChibiGuard />

      {/* Modals */}
      <CreateCourseModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCourseCreated={async (newCourse) => {
          await saveCourse(newCourse);
          await refreshData();
          router.push(ROUTES.book(newCourse.id));
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