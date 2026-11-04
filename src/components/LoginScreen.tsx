"use client";

import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Sparkles,
  Settings,
  ArrowRight,
  User,
  Mail,
  Lock,
  Layers,
  GraduationCap,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  signInWithGoogle,
  signInWithEmailPassword,
  signInWithLocalProfile,
  consumeSessionExpiredNotice,
  AppUser,
} from "@/lib/storage";
import { ensureUserQuotaProvisioned } from "@/lib/quotaManager";

interface LoginScreenProps {
  onLoginSuccess: (user: AppUser) => void;
  onOpenSettings: () => void;
}

export default function LoginScreen({
  onLoginSuccess,
  onOpenSettings,
}: LoginScreenProps) {
  const [tab, setTab] = useState<"google_quick" | "email" | "guest">("google_quick");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);

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

  // Email form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(true);
  const [isEmailLoading, setIsEmailLoading] = useState(false);

  // Guest / Local profile form
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [isGuestLoading, setIsGuestLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setIsGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setErrorMessage(
        error.message.includes("Chưa cấu hình Supabase")
          ? "Chưa cấu hình Google Auth trên hệ thống. Bạn hãy điền Tên & Email ở bên dưới hoặc chọn tab 'Tài khoản Email' để đăng ký và vào học ngay!"
          : error.message
      );
      setIsGoogleLoading(false);
    }
    // If OAuth starts, browser will redirect
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Vui lòng nhập đầy đủ Email và Mật khẩu.");
      return;
    }
    setErrorMessage(null);
    setIsEmailLoading(true);
    const { user, error } = await signInWithEmailPassword(
      email,
      password,
      isSignUp
    );
    if (error) {
      setIsEmailLoading(false);
      setErrorMessage(error.message);
      return;
    }
    if (user) {
      await ensureUserQuotaProvisioned(user, { isNewRegistration: isSignUp });
      setIsEmailLoading(false);
      onLoginSuccess(user);
    } else {
      setIsEmailLoading(false);
    }
  };

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGuestLoading(true);
    const name = guestName.trim() || "Học viên BookMind";
    const mail =
      guestEmail.trim() ||
      `${name.toLowerCase().replace(/\s+/g, "")}@bookmind.ai`;
    const user = signInWithLocalProfile(name, mail);
    await ensureUserQuotaProvisioned(user, { isNewRegistration: true });
    setIsGuestLoading(false);
    onLoginSuccess(user);
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-slate-950 overflow-hidden select-none">
      {/* Background Glow Orbs */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-indigo-600/15 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 left-1/3 w-[500px] h-[400px] rounded-full bg-purple-600/10 blur-[100px]" />

      <div className="relative z-10 w-full max-w-md mx-auto">
        {/* Brand Header */}
        <div className="text-center mb-6 relative">
          <div className="absolute right-0 top-0">
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800/90 bg-slate-900/80 hover:bg-slate-800 text-xs text-slate-300 hover:text-white transition cursor-pointer shadow-sm"
              title="Cài đặt Supabase & Mô hình AI"
            >
              <Settings className="h-3.5 w-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Cài đặt</span>
            </button>
          </div>

          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-500/25 ring-1 ring-white/20 mb-4 animate-in fade-in zoom-in duration-300">
            <BookOpen className="h-7 w-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            BookMind <span className="text-indigo-400">AI</span>
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
            Đăng nhập để vào không gian học tập thông minh từ sách PDF & giáo trình chuyên sâu của bạn
          </p>
        </div>

        {/* Auth Card */}
        <div className="rounded-3xl border border-slate-800/90 bg-slate-900/80 p-6 sm:p-7 shadow-2xl backdrop-blur-xl">
          {/* Session Expired Auto-Logout Banner */}
          {sessionExpiredMessage && (
            <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-amber-500/40 bg-amber-950/50 p-3.5 text-xs text-amber-200 leading-relaxed shadow-lg">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <div className="font-extrabold text-amber-300 uppercase tracking-wide text-[10px] mb-0.5">
                  Phiên Đăng Nhập Đã Hết Hạn (Tự Động Đăng Xuất)
                </div>
                <span>{sessionExpiredMessage}</span>
              </div>
            </div>
          )}

          {/* Error Banner with Quick Action */}
          {errorMessage && (
            <div className="mb-5 rounded-2xl border border-rose-500/40 bg-rose-950/40 p-4 text-xs text-rose-200 leading-relaxed space-y-2.5">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <div>{errorMessage}</div>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-rose-500/20">
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 px-3 py-1.5 text-xs font-bold text-rose-200 transition cursor-pointer"
                >
                  <Settings className="h-3.5 w-3.5 text-rose-300" />
                  <span>Mở Cài Đặt để nhập Supabase Key</span>
                </button>
              </div>
            </div>
          )}

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-950/70 border border-slate-800 mb-5">
            <button
              type="button"
              onClick={() => {
                setTab("google_quick");
                setErrorMessage(null);
              }}
              className={`py-2 text-xs font-semibold rounded-xl transition ${
                tab === "google_quick"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Google & Nhanh
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("email");
                setErrorMessage(null);
              }}
              className={`py-2 text-xs font-semibold rounded-xl transition ${
                tab === "email"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Tài khoản Email
            </button>
          </div>

          {tab === "google_quick" ? (
            <div className="space-y-4">
              {/* Google Button */}
              <button
                type="button"
                disabled={isGoogleLoading}
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm shadow-md transition transform active:scale-[0.98] disabled:opacity-70 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                    ? "Đang kết nối Google..."
                    : "Đăng nhập bằng Google"}
                </span>
              </button>

              <div className="relative flex items-center justify-center my-4">
                <div className="border-t border-slate-800 w-full" />
                <span className="bg-slate-900 px-3 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Hoặc bắt đầu nhanh
                </span>
                <div className="border-t border-slate-800 w-full" />
              </div>

              {/* Guest / Quick Learner */}
              <form onSubmit={handleGuestSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Họ & Tên / Biệt danh của bạn
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Ví dụ: Minh Anh, Nguyen..."
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/80 pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Email tài khoản (Tự động tặng 15 lượt gọi AI / ngày)
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="nhap-email@gmail.com"
                      required
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/80 pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Khi đăng ký, hệ thống sẽ tự động gắn API Key vào tài khoản của bạn (không cần nhập tay) và gửi thông báo xác nhận.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isGuestLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                >
                  <span>
                    {isGuestLoading
                      ? "Đang khởi tạo tài khoản..."
                      : "Đăng ký & Bắt đầu học ngay (15 lượt AI/ngày)"}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          ) : (
            /* Email Form */
            <form onSubmit={handleEmailSubmit} className="space-y-3.5">
              <div className="rounded-xl border border-indigo-500/25 bg-indigo-950/25 px-3.5 py-2.5 text-[11px] text-indigo-200 leading-relaxed">
                {isSignUp
                  ? "Đăng ký tài khoản mới sẽ được tự động gắn API Key nội bộ (15 lượt gọi AI / ngày, tự động reset mỗi ngày) mà không cần nhập Key."
                  : "Đăng nhập vào tài khoản đã có của bạn."}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Email tài khoản
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                >
                  {isSignUp
                    ? "Đã có tài khoản? Chuyển sang Đăng nhập"
                    : "Chưa có tài khoản? Đăng ký mới nhận 15 lượt AI"}
                </button>
              </div>

              <button
                type="submit"
                disabled={isEmailLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              >
                <span>
                  {isEmailLoading
                    ? "Đang xử lý & gửi Email API Key..."
                    : isSignUp
                    ? "Đăng ký & Gửi API Key về Email"
                    : "Đăng nhập"}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
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

