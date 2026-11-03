"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  Check,
  Crown,
  Zap,
  Infinity as InfinityIcon,
  QrCode,
  ShieldCheck,
  ArrowLeft,
  Mail,
  CheckCircle2,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { PlanTier, UserQuotaAccount } from "@/types/course";
import {
  PLAN_CONFIG,
  AI_TASK_CREDITS,
  VIP_FUP_DAILY_CREDITS,
  upgradeUserPlanAfterPayment,
} from "@/lib/quotaManager";
import { AppUser } from "@/lib/storage";

interface UpgradePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser | null;
  quotaAccount: UserQuotaAccount | null;
  initialPrefillKey?: string;
  onOpenInbox: () => void;
  onQuotaChanged: () => void;
}

/**
 * Tạo ma trận QR 21x21 giả lập sắc nét có 3 góc định vị chuẩn QR Code
 */
function generateQrMatrix(seed: string): boolean[][] {
  const size = 21;
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );

  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        matrix[r0 + r][c0 + c] = isBorder || isInner;
      }
    }
  };

  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= size - 8;
      const inBottomLeft = r >= size - 8 && c < 8;
      const inCenterLogo = r >= 8 && r <= 12 && c >= 8 && c <= 12;
      if (inTopLeft || inTopRight || inBottomLeft || inCenterLogo) continue;

      const bit = ((hash >>> ((r * size + c) % 24)) ^ (r * 13 + c * 7)) & 1;
      matrix[r][c] = bit === 1;
    }
  }

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  return matrix;
}

export default function UpgradePlanModal({
  isOpen,
  onClose,
  currentUser,
  quotaAccount,
  onOpenInbox,
  onQuotaChanged,
}: UpgradePlanModalProps) {
  const [checkoutPlan, setCheckoutPlan] = useState<"pro" | "unlimited" | null>(
    null
  );
  const [paymentMethod, setPaymentMethod] = useState<"momo" | "vnpay">("momo");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentReceipt, setPaymentReceipt] = useState<{
    plan: "pro" | "unlimited";
    orderCode: string;
    method: "momo" | "vnpay";
    email: string;
  } | null>(null);
  const [countdown, setCountdown] = useState(600);

  useEffect(() => {
    if (isOpen) {
      setCheckoutPlan(null);
      setPaymentReceipt(null);
      setRecipientEmail(currentUser?.email || quotaAccount?.email || "");
    }
  }, [isOpen, quotaAccount, currentUser]);

  useEffect(() => {
    if (!checkoutPlan || paymentReceipt) return;
    setCountdown(600);
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [checkoutPlan, paymentReceipt]);

  if (!isOpen) return null;

  const handleSimulatePaymentSuccess = async () => {
    if (!currentUser || !checkoutPlan) return;
    setIsProcessingPayment(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const result = await upgradeUserPlanAfterPayment({
      user: currentUser,
      targetPlan: checkoutPlan,
      paymentMethod,
      recipientEmail: recipientEmail.trim() || currentUser.email,
      autoActivate: true,
    });

    setIsProcessingPayment(false);
    setPaymentReceipt({
      plan: checkoutPlan,
      orderCode: result.orderCode,
      method: paymentMethod,
      email: result.account.email,
    });
    onQuotaChanged();
  };

  const currentPlan: PlanTier = quotaAccount?.plan || "free";
  const usedCalls = quotaAccount?.usedCalls || 0;
  const maxCalls = quotaAccount?.maxCalls ?? 30;
  const isUnlimited = currentPlan === "unlimited" || maxCalls === -1;
  const effectiveMax = isUnlimited
    ? quotaAccount?.fupDailyLimit || VIP_FUP_DAILY_CREDITS
    : maxCalls;
  const usagePercent = Math.min(
    100,
    Math.round((usedCalls / Math.max(1, effectiveMax)) * 100)
  );

  const formatCountdown = (sec: number) => {
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  const qrMatrix = generateQrMatrix(
    `${checkoutPlan}-${paymentMethod}-${recipientEmail}`
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white">
                Hệ Thống AI Credit & Gói Học Tập Hàng Ngày
              </h2>
              <p className="text-xs text-slate-400">
                Tính phí công bằng theo trọng số tác vụ (1–5 Credit) • Tự động hoàn 100% Credit nếu lỗi • Reset về 0 lúc 00:00 mỗi ngày
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* BANNER CẢNH BÁO KHI ĐÃ HẾT CREDIT TRONG NGÀY */}
          {usedCalls >= effectiveMax && !paymentReceipt && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-rose-500/40 bg-gradient-to-r from-rose-950/60 via-amber-950/30 to-slate-950 p-4 shadow-lg shadow-rose-950/20">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-rose-200">
                    Bạn đã sử dụng hết {usedCalls}/{effectiveMax} AI Credits trong ngày hôm nay!
                  </h3>
                  <p className="mt-1 text-xs text-rose-200/80 leading-relaxed">
                    Hạn mức AI Credit của gói <strong>{PLAN_CONFIG[currentPlan].name}</strong> sẽ tự động reset về <strong>0/{effectiveMax} Credits</strong> vào lúc <strong>00:00 ngày mai</strong>. Để tiếp tục học tập ngay lập tức, hãy chọn <strong>Nâng cấp Gói Pro (120 Credits/ngày)</strong> hoặc <strong>Gói VIP Unlimited (FUP 500 Credits/ngày)</strong> bên dưới!
                  </p>
                </div>
              </div>
              {!checkoutPlan && !isUnlimited && (
                <button
                  type="button"
                  onClick={() =>
                    setCheckoutPlan(currentPlan === "free" ? "pro" : "unlimited")
                  }
                  className="shrink-0 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 transition cursor-pointer"
                >
                  Nâng cấp ngay →
                </button>
              )}
            </div>
          )}

          {/* SECTION 1: TRẠNG THÁI GÓI & LƯỢT GỌI TRONG NGÀY HÔM NAY */}
          <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/30 via-slate-950 to-slate-950 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-white">
                      {PLAN_CONFIG[currentPlan].name}
                    </h3>
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      <Check className="h-3 w-3" />
                      Đã tự động liên kết API Key
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tài khoản: <strong className="text-slate-200">{currentUser?.email || quotaAccount?.email}</strong> • Không cần nhập API Key thủ công
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300">
                <RefreshCw className="h-3.5 w-3.5 text-indigo-400" />
                <span>Tự động reset lúc 00:00 mỗi ngày</span>
              </div>
            </div>

            {/* Quota Meter */}
            <div className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-2">
                <span className="text-slate-300 font-semibold">
                  Số AI Credit đã sử dụng hôm nay ({quotaAccount?.lastResetDate || "Hôm nay"}):
                </span>

                <div className="font-bold text-white">
                  {isUnlimited ? (
                    <span className="flex items-center gap-1 text-purple-300">
                      <InfinityIcon className="h-4 w-4" />
                      Đã dùng {usedCalls} / {effectiveMax} Credits hôm nay (Gói VIP • Fair Usage Policy)
                    </span>
                  ) : (
                    <span>
                      Đã dùng:{" "}
                      <span
                        className={
                          usedCalls >= effectiveMax
                            ? "text-rose-400"
                            : "text-emerald-300"
                        }
                      >
                        {usedCalls} / {effectiveMax} AI Credits
                      </span>{" "}
                      (Còn lại {Math.max(0, effectiveMax - usedCalls)} Credits hôm nay)
                    </span>
                  )}
                </div>
              </div>

              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800">
                <div
                  className={`h-full transition-all duration-500 ${
                    isUnlimited
                      ? "bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-400"
                      : usedCalls >= effectiveMax
                      ? "bg-rose-500"
                      : "bg-gradient-to-r from-indigo-500 to-emerald-400"
                  }`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: CHỌN GÓI NÂNG CẤP HOẶC CỔNG THANH TOÁN QR ẢO */}
          {!checkoutPlan ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-300">
                  Bảng Gói Cước AI Credit & Nâng Cấp Tự Động (Thanh Toán QR VNPay / MoMo Ảo)
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* FREE CARD */}
                <div
                  className={`flex flex-col justify-between rounded-2xl border p-5 transition ${
                    currentPlan === "free"
                      ? "border-emerald-500/40 bg-emerald-950/10"
                      : "border-slate-800 bg-slate-950/60"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-300">
                        Starter • 30 Credits/ngày
                      </span>
                      {currentPlan === "free" && (
                        <span className="text-[11px] font-bold text-emerald-400">
                          • Đang kích hoạt
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-lg font-extrabold text-white">
                        Gói Free
                      </h4>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-2xl font-black text-white">0đ</span>
                        <span className="text-xs text-slate-400">
                          / 30 AI Credits mỗi ngày
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {PLAN_CONFIG.free.description}
                    </p>
                    <ul className="space-y-2 pt-2 border-t border-slate-800/80 text-xs text-slate-300">
                      {PLAN_CONFIG.free.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-800/60">
                    <div className="w-full rounded-xl border border-slate-800 bg-slate-900/70 py-2.5 text-center text-xs font-bold text-slate-400">
                      Tự động cấp khi đăng ký
                    </div>
                  </div>
                </div>

                {/* PRO CARD (120 CREDITS / DAY) */}
                <div
                  className={`relative flex flex-col justify-between rounded-2xl border p-5 transition ${
                    currentPlan === "pro"
                      ? "border-amber-500/60 bg-amber-950/15 shadow-lg shadow-amber-500/10"
                      : "border-indigo-500/50 bg-gradient-to-b from-indigo-950/30 to-slate-950 shadow-xl shadow-indigo-600/10"
                  }`}
                >
                  <div className="absolute -top-3 right-4 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-950 shadow">
                    Phổ biến nhất
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 text-xs font-bold text-amber-300">
                        <Zap className="h-3.5 w-3.5" />
                        120 Credits / Ngày
                      </span>
                      {currentPlan === "pro" && (
                        <span className="text-[11px] font-bold text-amber-400">
                          • Đang sử dụng
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-lg font-extrabold text-white">
                        BookMind Pro
                      </h4>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-2xl font-black text-amber-300">
                          49.000đ
                        </span>
                        <span className="text-xs text-slate-400">
                          / 120 AI Credits mỗi ngày
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {PLAN_CONFIG.pro.description}
                    </p>
                    <ul className="space-y-2 pt-2 border-t border-slate-800/80 text-xs text-slate-200">
                      {PLAN_CONFIG.pro.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-800/60">
                    <button
                      type="button"
                      onClick={() => {
                        setCheckoutPlan("pro");
                        setPaymentReceipt(null);
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 py-2.5 text-xs font-extrabold text-slate-950 shadow-lg shadow-amber-500/20 transition cursor-pointer"
                    >
                      <QrCode className="h-4 w-4" />
                      <span>Nâng cấp Pro (120 Credits/ngày)</span>
                    </button>
                  </div>
                </div>

                {/* UNLIMITED VIP CARD (FUP 500 CREDITS/DAY) */}
                <div
                  className={`flex flex-col justify-between rounded-2xl border p-5 transition ${
                    currentPlan === "unlimited"
                      ? "border-purple-500/60 bg-purple-950/20 shadow-lg shadow-purple-500/10"
                      : "border-purple-500/40 bg-gradient-to-b from-purple-950/25 to-slate-950"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-purple-500/20 border border-purple-500/30 px-2.5 py-1 text-xs font-bold text-purple-300">
                        <InfinityIcon className="h-3.5 w-3.5" />
                        VIP Unlimited • FUP
                      </span>
                      {currentPlan === "unlimited" && (
                        <span className="text-[11px] font-bold text-purple-300">
                          • Đang sử dụng
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-lg font-extrabold text-white">
                        BookMind VIP
                      </h4>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-2xl font-black text-purple-300">
                          149.000đ
                        </span>
                        <span className="text-xs text-slate-400">
                          / FUP 500 Credits/ngày
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {PLAN_CONFIG.unlimited.description}
                    </p>
                    <ul className="space-y-2 pt-2 border-t border-slate-800/80 text-xs text-slate-200">
                      {PLAN_CONFIG.unlimited.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="h-3.5 w-3.5 text-purple-400 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-800/60">
                    <button
                      type="button"
                      onClick={() => {
                        setCheckoutPlan("unlimited");
                        setPaymentReceipt(null);
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-purple-600/25 transition cursor-pointer"
                    >
                      <QrCode className="h-4 w-4" />
                      <span>Nâng cấp VIP (FUP 500 Credits)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* BẢNG TRỌNG SỐ AI CREDIT THEO TÁC VỤ & CHÍNH SÁCH HOÀN TRẢ CREDIT */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Bảng Quy Đổi AI Credit Theo Trọng Số Tác Vụ & Bảo Vệ Hoàn Credit</span>
                  </h4>
                  <span className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                    ✓ Tự động hoàn 100% Credit nếu AI hoặc mạng gặp lỗi
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                  {Object.values(AI_TASK_CREDITS).map((task) => (
                    <div
                      key={task.endpoint}
                      className="flex items-center justify-between rounded-xl border border-slate-800/90 bg-slate-900/70 px-3.5 py-2.5"
                    >
                      <div className="pr-2">
                        <div className="font-bold text-slate-200">{task.taskLabel}</div>
                        <div className="text-[10px] text-slate-400">
                          Chi phí tài nguyên: {task.costTier}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-lg px-2.5 py-1 font-mono text-xs font-extrabold ${
                          task.credits === 1
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : task.credits <= 3
                            ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                            : "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                        }`}
                      >
                        {task.credits} Credit
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : paymentReceipt ? (
            /* PAYMENT RECEIPT SCREEN */
            <div className="rounded-3xl border border-emerald-500/40 bg-gradient-to-b from-emerald-950/30 to-slate-950 p-6 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="h-8 w-8" />
              </div>

              <div>
                <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-bold text-emerald-300">
                  Giao dịch thành công • {paymentReceipt.orderCode}
                </span>
                <h3 className="mt-2 text-xl font-extrabold text-white">
                  Tài khoản đã được nâng cấp lên {PLAN_CONFIG[paymentReceipt.plan].name}!
                </h3>
                <p className="mt-1 text-xs text-slate-300">
                  Hệ thống đã tự động cập nhật API Key và hạn mức mới trực tiếp vào tài khoản của bạn (kèm thư xác nhận gửi tới{" "}
                  <strong className="text-emerald-300">
                    {paymentReceipt.email}
                  </strong>
                  ). Bạn có thể vào học tiếp ngay mà không cần nhập Key!
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Hoàn tất & Vào học ngay</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenInbox();
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition cursor-pointer"
                >
                  <Mail className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Xem thông báo xác nhận</span>
                </button>
              </div>
            </div>
          ) : (
            /* VIRTUAL QR CHECKOUT STEP (MOMO / VNPAY) */
            <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-5 sm:p-6 space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <button
                  type="button"
                  onClick={() => setCheckoutPlan(null)}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Chọn lại gói cước</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">
                    Thời gian chờ thanh toán:
                  </span>
                  <span className="rounded-lg bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 font-mono text-xs font-bold text-amber-300">
                    {formatCountdown(countdown)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-12 items-center">
                {/* Left: Payment Method Selector & Order Info */}
                <div className="md:col-span-7 space-y-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                      Cổng Thanh Toán QR Ảo (Sandbox)
                    </span>
                    <h3 className="text-lg font-extrabold text-white mt-0.5">
                      Thanh toán nâng cấp {PLAN_CONFIG[checkoutPlan].name}
                    </h3>
                  </div>

                  {/* Method Tabs: MoMo vs VNPay */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("momo")}
                      className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition cursor-pointer ${
                        paymentMethod === "momo"
                          ? "border-pink-500/60 bg-pink-950/25 ring-2 ring-pink-500/20"
                          : "border-slate-800 bg-slate-900/60 hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#A50064] text-white font-black text-xs shadow">
                        MoMo
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-white">
                          Ví MoMo QR
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Quét mã thanh toán tức thì
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod("vnpay")}
                      className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition cursor-pointer ${
                        paymentMethod === "vnpay"
                          ? "border-sky-500/60 bg-sky-950/25 ring-2 ring-sky-500/20"
                          : "border-slate-800 bg-slate-900/60 hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#005BAA] text-white font-black text-[11px] shadow">
                        VNPAY
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-white">
                          VNPay SmartQR
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Hỗ trợ 40+ App Ngân hàng
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Order Summary Box */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Gói nâng cấp:</span>
                      <span className="font-bold text-white">
                        {PLAN_CONFIG[checkoutPlan].name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Hạn mức mỗi ngày:</span>
                      <span className="font-bold text-emerald-300">
                        {checkoutPlan === "unlimited"
                          ? "Không giới hạn lượt gọi AI (∞)"
                          : "50 lượt gọi AI / ngày (Tự động reset 00:00)"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Số tiền thanh toán:</span>
                      <span className="text-base font-black text-amber-300">
                        {PLAN_CONFIG[checkoutPlan].priceFormatted}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-800">
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Email nhận thông báo xác nhận nâng cấp:
                      </label>
                      <input
                        type="email"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        placeholder="nhap-email@example.com"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Simulate Payment Button */}
                  <button
                    type="button"
                    disabled={isProcessingPayment}
                    onClick={handleSimulatePaymentSuccess}
                    className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 px-5 text-xs sm:text-sm font-extrabold text-white shadow-xl transition cursor-pointer disabled:opacity-60 ${
                      paymentMethod === "momo"
                        ? "bg-gradient-to-r from-[#A50064] to-pink-600 hover:from-[#b80070] hover:to-pink-500 shadow-pink-600/25"
                        : "bg-gradient-to-r from-[#005BAA] to-indigo-600 hover:from-sky-600 hover:to-indigo-500 shadow-sky-600/25"
                    }`}
                  >
                    {isProcessingPayment ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>
                          Đang xác nhận giao dịch{" "}
                          {paymentMethod === "momo" ? "MoMo" : "VNPay"} & nâng cấp tài khoản...
                        </span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        <span>
                          Xác nhận Đã Quét QR / Thanh toán Ảo Thành công (
                          {PLAN_CONFIG[checkoutPlan].priceFormatted})
                        </span>
                      </>
                    )}
                  </button>
                </div>

                {/* Right: Realistic QR Code Box */}
                <div className="md:col-span-5 flex flex-col items-center">
                  <div
                    className={`w-full max-w-[260px] rounded-3xl border-2 p-4 text-center shadow-2xl ${
                      paymentMethod === "momo"
                        ? "border-pink-500/40 bg-gradient-to-b from-[#A50064]/20 to-slate-950"
                        : "border-sky-500/40 bg-gradient-to-b from-[#005BAA]/20 to-slate-950"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between text-[11px] font-bold">
                      <span
                        className={
                          paymentMethod === "momo"
                            ? "text-pink-300"
                            : "text-sky-300"
                        }
                      >
                        {paymentMethod === "momo"
                          ? "MOMO PAYMENT QR"
                          : "VNPAY SMART QR"}
                      </span>
                      <span className="text-white">
                        {PLAN_CONFIG[checkoutPlan].priceFormatted}
                      </span>
                    </div>

                    {/* White QR Frame */}
                    <div className="relative mx-auto flex h-48 w-48 items-center justify-center rounded-2xl bg-white p-3 shadow-inner">
                      <svg
                        viewBox="0 0 21 21"
                        className="h-full w-full"
                        shapeRendering="crispEdges"
                      >
                        {qrMatrix.map((row, rIdx) =>
                          row.map((cell, cIdx) =>
                            cell ? (
                              <rect
                                key={`${rIdx}-${cIdx}`}
                                x={cIdx}
                                y={rIdx}
                                width={1}
                                height={1}
                                fill={
                                  paymentMethod === "momo"
                                    ? "#4a042e"
                                    : "#082f49"
                                }
                              />
                            ) : null
                          )
                        )}
                      </svg>

                      {/* Center Logo Badge */}
                      <div
                        className={`absolute flex h-9 w-9 items-center justify-center rounded-lg font-black text-[9px] text-white shadow-md ring-2 ring-white ${
                          paymentMethod === "momo"
                            ? "bg-[#A50064]"
                            : "bg-[#005BAA]"
                        }`}
                      >
                        {paymentMethod === "momo" ? "MoMo" : "VNPAY"}
                      </div>
                    </div>

                    <div className="mt-3 space-y-0.5 text-[11px]">
                      <div className="font-bold text-white">
                        BOOKMIND AI EDUCATION
                      </div>
                      <div className="text-slate-400">
                        Nội dung:{" "}
                        <code className="text-emerald-300 font-mono">
                          BM {checkoutPlan.toUpperCase()}
                        </code>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
