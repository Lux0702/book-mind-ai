"use client";

import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Sparkles,
  Layers,
  GraduationCap,
  Clock,
  AlertCircle,
} from "lucide-react";
import {
  signInWithGoogle,
  consumeSessionExpiredNotice,
  AppUser,
} from "@/lib/storage";

interface LoginScreenProps {
  onLoginSuccess: (user: AppUser) => void;
  onOpenSettings?: () => void;
}

export default function LoginScreen({}: LoginScreenProps) {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<
    string | null
  >(null);

  useEffect(() => {
    const notice = consumeSessionExpiredNotice();
    if (notice) {
      setSessionExpiredMessage(notice);
    }
    const handleExpired = (e: Event) => {
      const evt = e as CustomEvent<{ reason?: string }>;
      setSessionExpiredMessage(
        evt.detail?.reason ||
          "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục!"
      );
    };
    window.addEventListener("bookmind:session-expired", handleExpired);
    return () =>
      window.removeEventListener("bookmind:session-expired", handleExpired);
  }, []);

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setIsGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setErrorMessage(error.message);
      setIsGoogleLoading(false);
    }
    // Khi OAuth bắt đầu, trình duyệt sẽ chuyển hướng sang Google
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-slate-950 overflow-hidden select-none">
      {/* Background Glow Orbs */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-indigo-600/15 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 left-1/3 w-[500px] h-[400px] rounded-full bg-purple-600/10 blur-[100px]" />

      <div className="relative z-10 w-full max-w-md mx-auto">
        {/* Brand Header */}
        <div className="text-center mb-6 relative">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-500/25 ring-1 ring-white/20 mb-4 animate-in fade-in zoom-in duration-300">
            <BookOpen className="h-7 w-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            BookMind <span className="text-indigo-400">AI</span>
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
            Đăng nhập bằng tài khoản Google để vào không gian học tập thông minh
            từ sách PDF & giáo trình chuyên sâu của bạn
          </p>
        </div>

        {/* Auth Card */}
        <div className="rounded-3xl border border-slate-800/90 bg-slate-900/80 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {/* Session Expired Auto-Logout Banner */}
          {sessionExpiredMessage && (
            <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-amber-500/40 bg-amber-950/50 p-3.5 text-xs text-amber-200 leading-relaxed shadow-lg">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <div className="font-extrabold text-amber-300 uppercase tracking-wide text-[10px] mb-0.5">
                  Phiên Đăng Nhập Đã Hết Hạn
                </div>
                <span>{sessionExpiredMessage}</span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-5 rounded-2xl border border-rose-500/40 bg-rose-950/40 p-4 text-xs text-rose-200 leading-relaxed">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <div>{errorMessage}</div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <button
              type="button"
              disabled={isGoogleLoading}
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-5 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm shadow-lg transition transform active:scale-[0.98] disabled:opacity-70 cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>
                {isGoogleLoading
                  ? "Đang kết nối với Google..."
                  : "Đăng nhập bằng Google"}
              </span>
            </button>

            <p className="text-center text-[11px] text-slate-400 leading-relaxed">
              Hệ thống đồng bộ tự động tiến độ học tập, khóa học PDF, Flashcard
              SRS và hạn mức AI theo tài khoản Google của bạn.
            </p>
          </div>
        </div>

        {/* Feature Badges under card */}
        <div className="mt-8 grid grid-cols-2 gap-2.5 text-slate-400 text-[11px]">
          <div className="flex items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-900/50 p-2.5">
            <Layers className="h-4 w-4 text-indigo-400 shrink-0" />
            <span>Đọc file PDF 80MB+ trực tiếp</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-900/50 p-2.5">
            <Sparkles className="h-4 w-4 text-purple-400 shrink-0" />
            <span>AI phân tích từ vựng & ngữ pháp</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-900/50 p-2.5">
            <GraduationCap className="h-4 w-4 text-amber-400 shrink-0" />
            <span>Flashcard SRS ngắt quãng</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-900/50 p-2.5">
            <Clock className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Thi trắc nghiệm tính giờ từng câu</span>
          </div>
        </div>
      </div>
    </div>
  );
}
