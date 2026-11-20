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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#141413]/85 p-4">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] text-[#F5EFE6] shadow-[6px_6px_0_0_#F5EFE6]">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[#F5EFE6] bg-[#141413] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] text-[#141413]">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#F5EFE6]">
                Hệ Thống AI Credit & Gói Học Tập Hàng Ngày
              </h2>
              <p className="text-xs text-[#B8B2A6]">
                Tính phí công bằng theo trọng số tác vụ (1–5 Credit) • Tự động hoàn 100% Credit nếu lỗi • Reset về 0 lúc 00:00 mỗi ngày
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-2 text-[#F5EFE6] hover:bg-[#FF8A8A] hover:text-[#141413] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* BANNER CẢNH BÁO KHI ĐÃ HẾT CREDIT TRONG NGÀY */}
          {usedCalls >= effectiveMax && !paymentReceipt && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border-2 border-[#F5EFE6] bg-[#FF8A8A] p-4 text-[#141413] shadow-[4px_4px_0_0_#F5EFE6]">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[#141413] bg-[#141413] text-[#FF8A8A]">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#141413]">
                    Bạn đã sử dụng hết {usedCalls}/{effectiveMax} AI Credits trong ngày hôm nay!
                  </h3>
                  <p className="mt-1 text-xs text-[#141413]/90 font-medium leading-relaxed">
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
                  className="shrink-0 rounded-xl border-2 border-[#141413] bg-[#F3C969] px-4 py-2.5 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#141413] transition-transform active:translate-x-[2px] active:translate-y-[2px] cursor-pointer"
                >
                  Nâng cấp ngay →
                </button>
              )}
            </div>
          )}

          {/* SECTION 1: TRẠNG THÁI GÓI & LƯỢT GỌI TRONG NGÀY HÔM NAY */}
          <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#141413] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] text-[#141413]">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-extrabold text-[#F5EFE6]">
                      {PLAN_CONFIG[currentPlan].name}
                    </h3>
                    <span className="inline-flex items-center gap-1 rounded-full border-2 border-[#F5EFE6] bg-[#A7D7A9] px-2.5 py-0.5 text-[10px] font-extrabold text-[#141413]">
                      <Check className="h-3 w-3" />
                      Đã tự động liên kết API Key
                    </span>
                  </div>
                  <p className="text-xs text-[#B8B2A6] mt-0.5">
                    Tài khoản: <strong className="text-[#F5EFE6]">{currentUser?.email || quotaAccount?.email}</strong> • Không cần nhập API Key thủ công
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg border-2 border-[#3A3832] bg-[#1D1C19] px-3 py-1.5 text-xs font-semibold text-[#F5EFE6]">
                <RefreshCw className="h-3.5 w-3.5 text-[#B8D8F8]" />
                <span>Tự động reset lúc 00:00 mỗi ngày</span>
              </div>
            </div>

            {/* Quota Meter */}
            <div className="rounded-lg border-2 border-[#3A3832] bg-[#1D1C19] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-2">
                <span className="text-[#B8B2A6] font-bold">
                  Số AI Credit đã sử dụng hôm nay ({quotaAccount?.lastResetDate || "Hôm nay"}):
                </span>

                <div className="font-extrabold text-[#F5EFE6]">
                  {isUnlimited ? (
                    <span className="flex items-center gap-1 text-[#C8B6FF]">
                      <InfinityIcon className="h-4 w-4" />
                      Đã dùng {usedCalls} / {effectiveMax} Credits hôm nay (Gói VIP • Fair Usage Policy)
                    </span>
                  ) : (
                    <span>
                      Đã dùng:{" "}
                      <span
                        className={
                          usedCalls >= effectiveMax
                            ? "text-[#FF8A8A]"
                            : "text-[#A7D7A9]"
                        }
                      >
                        {usedCalls} / {effectiveMax} AI Credits
                      </span>{" "}
                      (Còn lại {Math.max(0, effectiveMax - usedCalls)} Credits hôm nay)
                    </span>
                  )}
                </div>
              </div>

              <div className="h-3 w-full overflow-hidden rounded-full border-2 border-[#F5EFE6] bg-[#141413]">
                <div
                  className={`h-full transition-all duration-300 ${
                    isUnlimited
                      ? "bg-[#C8B6FF]"
                      : usedCalls >= effectiveMax
                      ? "bg-[#FF8A8A]"
                      : "bg-[#A7D7A9]"
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
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#F3C969]">
                  Bảng Gói Cước AI Credit & Nâng Cấp Tự Động (Thanh Toán QR VNPay / MoMo Ảo)
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* FREE CARD */}
                <div
                  className={`flex flex-col justify-between rounded-xl border-2 p-5 ${
                    currentPlan === "free"
                      ? "border-[#A7D7A9] bg-[#141413]"
                      : "border-[#3A3832] bg-[#141413]"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="rounded-lg border border-[#3A3832] bg-[#1D1C19] px-2.5 py-1 text-xs font-bold text-[#F5EFE6]">
                        Starter • 30 Credits/ngày
                      </span>
                      {currentPlan === "free" && (
                        <span className="text-[11px] font-extrabold text-[#A7D7A9]">
                          • Đang kích hoạt
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-lg font-extrabold text-[#F5EFE6]">
                        Gói Free
                      </h4>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-2xl font-black text-[#F5EFE6]">0đ</span>
                        <span className="text-xs text-[#B8B2A6]">
                          / 30 AI Credits mỗi ngày
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-[#B8B2A6] leading-relaxed">
                      {PLAN_CONFIG.free.description}
                    </p>
                    <ul className="space-y-2 pt-2 border-t-2 border-[#3A3832] text-xs text-[#F5EFE6]">
                      {PLAN_CONFIG.free.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="h-3.5 w-3.5 text-[#A7D7A9] shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-5 pt-3 border-t-2 border-[#3A3832]">
                    <div className="w-full rounded-xl border-2 border-[#3A3832] bg-[#1D1C19] py-2.5 text-center text-xs font-bold text-[#B8B2A6]">
                      Tự động cấp khi đăng ký
                    </div>
                  </div>
                </div>

                {/* PRO CARD (120 CREDITS / DAY) */}
                <div className="relative flex flex-col justify-between rounded-xl border-2 border-[#F5EFE6] bg-[#141413] p-5 shadow-[4px_4px_0_0_#F3C969]">
                  <div className="absolute -top-3 right-4 rounded-full border-2 border-[#141413] bg-[#F3C969] px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#141413]">
                    Phổ biến nhất
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 rounded-lg border-2 border-[#F5EFE6] bg-[#F3C969] px-2.5 py-0.5 text-xs font-extrabold text-[#141413]">
                        <Zap className="h-3.5 w-3.5" />
                        120 Credits / Ngày
                      </span>
                      {currentPlan === "pro" && (
                        <span className="text-[11px] font-extrabold text-[#F3C969]">
                          • Đang sử dụng
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-lg font-extrabold text-[#F5EFE6]">
                        BookMind Pro
                      </h4>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-2xl font-black text-[#F3C969]">
                          49.000đ
                        </span>
                        <span className="text-xs text-[#B8B2A6]">
                          / 120 AI Credits mỗi ngày
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-[#B8B2A6] leading-relaxed">
                      {PLAN_CONFIG.pro.description}
                    </p>
                    <ul className="space-y-2 pt-2 border-t-2 border-[#3A3832] text-xs text-[#F5EFE6]">
                      {PLAN_CONFIG.pro.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="h-3.5 w-3.5 text-[#F3C969] shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-5 pt-3 border-t-2 border-[#3A3832]">
                    <button
                      type="button"
                      onClick={() => {
                        setCheckoutPlan("pro");
                        setPaymentReceipt(null);
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] py-2.5 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
                    >
                      <QrCode className="h-4 w-4" />
                      <span>Nâng cấp Pro (120 Credits/ngày)</span>
                    </button>
                  </div>
                </div>

                {/* UNLIMITED VIP CARD (FUP 500 CREDITS/DAY) */}
                <div className="flex flex-col justify-between rounded-xl border-2 border-[#F5EFE6] bg-[#141413] p-5 shadow-[4px_4px_0_0_#C8B6FF]">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 rounded-lg border-2 border-[#F5EFE6] bg-[#C8B6FF] px-2.5 py-0.5 text-xs font-extrabold text-[#141413]">
                        <InfinityIcon className="h-3.5 w-3.5" />
                        VIP Unlimited • FUP
                      </span>
                      {currentPlan === "unlimited" && (
                        <span className="text-[11px] font-extrabold text-[#C8B6FF]">
                          • Đang sử dụng
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-lg font-extrabold text-[#F5EFE6]">
                        BookMind VIP
                      </h4>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-2xl font-black text-[#C8B6FF]">
                          149.000đ
                        </span>
                        <span className="text-xs text-[#B8B2A6]">
                          / FUP 500 Credits/ngày
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-[#B8B2A6] leading-relaxed">
                      {PLAN_CONFIG.unlimited.description}
                    </p>
                    <ul className="space-y-2 pt-2 border-t-2 border-[#3A3832] text-xs text-[#F5EFE6]">
                      {PLAN_CONFIG.unlimited.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="h-3.5 w-3.5 text-[#C8B6FF] shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-5 pt-3 border-t-2 border-[#3A3832]">
                    <button
                      type="button"
                      onClick={() => {
                        setCheckoutPlan("unlimited");
                        setPaymentReceipt(null);
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#C8B6FF] py-2.5 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
                    >
                      <QrCode className="h-4 w-4" />
                      <span>Nâng cấp VIP (FUP 500 Credits)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* BẢNG TRỌNG SỐ AI CREDIT THEO TÁC VỤ & CHÍNH SÁCH HOÀN TRẢ CREDIT */}
              <div className="rounded-xl border-2 border-[#3A3832] bg-[#141413] p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#B8D8F8] flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-[#F3C969]" />
                    <span>Bảng Quy Đổi AI Credit Theo Trọng Số Tác Vụ & Bảo Vệ Hoàn Credit</span>
                  </h4>
                  <span className="rounded-full border-2 border-[#F5EFE6] bg-[#A7D7A9] px-2.5 py-0.5 text-[11px] font-extrabold text-[#141413]">
                    ✓ Tự động hoàn 100% Credit nếu AI hoặc mạng gặp lỗi
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                  {Object.values(AI_TASK_CREDITS).map((task) => (
                    <div
                      key={task.endpoint}
                      className="flex items-center justify-between rounded-lg border-2 border-[#3A3832] bg-[#1D1C19] px-3.5 py-2.5"
                    >
                      <div className="pr-2">
                        <div className="font-bold text-[#F5EFE6]">{task.taskLabel}</div>
                        <div className="text-[10px] text-[#B8B2A6]">
                          Chi phí tài nguyên: {task.costTier}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-lg border border-[#141413] px-2.5 py-1 font-mono text-xs font-extrabold text-[#141413] ${
                          task.credits === 1
                            ? "bg-[#A7D7A9]"
                            : task.credits <= 3
                            ? "bg-[#F3C969]"
                            : "bg-[#C8B6FF]"
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
            <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#141413] p-6 text-center space-y-5 shadow-[4px_4px_0_0_#A7D7A9]">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] text-[#141413]">
                <CheckCircle2 className="h-8 w-8" />
              </div>

              <div>
                <span className="rounded-full border-2 border-[#F5EFE6] bg-[#A7D7A9] px-3 py-1 text-[11px] font-extrabold text-[#141413]">
                  Giao dịch thành công • {paymentReceipt.orderCode}
                </span>
                <h3 className="mt-3 text-xl font-extrabold text-[#F5EFE6]">
                  Tài khoản đã được nâng cấp lên {PLAN_CONFIG[paymentReceipt.plan].name}!
                </h3>
                <p className="mt-1 text-xs text-[#B8B2A6]">
                  Hệ thống đã tự động cập nhật API Key và hạn mức mới trực tiếp vào tài khoản của bạn (kèm thư xác nhận gửi tới{" "}
                  <strong className="text-[#A7D7A9]">
                    {paymentReceipt.email}
                  </strong>
                  ). Bạn có thể vào học tiếp ngay mà không cần nhập Key!
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-5 py-2.5 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] cursor-pointer"
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
                  className="flex items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] px-4 py-2.5 text-xs font-bold text-[#F5EFE6] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] cursor-pointer"
                >
                  <Mail className="h-3.5 w-3.5 text-[#B8D8F8]" />
                  <span>Xem thông báo xác nhận</span>
                </button>
              </div>
            </div>
          ) : (
            /* VIRTUAL QR CHECKOUT STEP (MOMO / VNPAY) */
            <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#141413] p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between border-b-2 border-[#3A3832] pb-4">
                <button
                  type="button"
                  onClick={() => setCheckoutPlan(null)}
                  className="flex items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] px-3 py-1.5 text-xs font-bold text-[#F5EFE6] hover:bg-[#F3C969] hover:text-[#141413] transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Chọn lại gói cước</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#B8B2A6]">
                    Thời gian chờ thanh toán:
                  </span>
                  <span className="rounded-lg border-2 border-[#F5EFE6] bg-[#F3C969] px-2.5 py-0.5 font-mono text-xs font-extrabold text-[#141413]">
                    {formatCountdown(countdown)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-12 items-center">
                {/* Left: Payment Method Selector & Order Info */}
                <div className="md:col-span-7 space-y-4">
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#B8D8F8]">
                      Cổng Thanh Toán QR Ảo (Sandbox)
                    </span>
                    <h3 className="text-lg font-extrabold text-[#F5EFE6] mt-0.5">
                      Thanh toán nâng cấp {PLAN_CONFIG[checkoutPlan].name}
                    </h3>
                  </div>

                  {/* Method Tabs: MoMo vs VNPay */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("momo")}
                      className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-colors cursor-pointer ${
                        paymentMethod === "momo"
                          ? "border-[#F5EFE6] bg-[#FF8A8A] text-[#141413] shadow-[3px_3px_0_0_#F5EFE6]"
                          : "border-[#3A3832] bg-[#1D1C19] text-[#F5EFE6] hover:border-[#F5EFE6]"
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-[#141413] bg-[#A50064] text-white font-black text-xs">
                        MoMo
                      </div>
                      <div>
                        <div className="text-xs font-extrabold">
                          Ví MoMo QR
                        </div>
                        <div className={`text-[10px] font-semibold ${paymentMethod === "momo" ? "text-[#141413]/80" : "text-[#B8B2A6]"}`}>
                          Quét mã thanh toán tức thì
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod("vnpay")}
                      className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-colors cursor-pointer ${
                        paymentMethod === "vnpay"
                          ? "border-[#F5EFE6] bg-[#B8D8F8] text-[#141413] shadow-[3px_3px_0_0_#F5EFE6]"
                          : "border-[#3A3832] bg-[#1D1C19] text-[#F5EFE6] hover:border-[#F5EFE6]"
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-[#141413] bg-[#005BAA] text-white font-black text-[11px]">
                        VNPAY
                      </div>
                      <div>
                        <div className="text-xs font-extrabold">
                          VNPay SmartQR
                        </div>
                        <div className={`text-[10px] font-semibold ${paymentMethod === "vnpay" ? "text-[#141413]/80" : "text-[#B8B2A6]"}`}>
                          Hỗ trợ 40+ App Ngân hàng
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Order Summary Box */}
                  <div className="rounded-lg border-2 border-[#3A3832] bg-[#1D1C19] p-4 space-y-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#B8B2A6]">Gói nâng cấp:</span>
                      <span className="font-extrabold text-[#F5EFE6]">
                        {PLAN_CONFIG[checkoutPlan].name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#B8B2A6]">Hạn mức mỗi ngày:</span>
                      <span className="font-extrabold text-[#A7D7A9]">
                        {checkoutPlan === "unlimited"
                          ? "Không giới hạn lượt gọi AI (∞)"
                          : "50 lượt gọi AI / ngày (Tự động reset 00:00)"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#B8B2A6]">Số tiền thanh toán:</span>
                      <span className="text-base font-black text-[#F3C969]">
                        {PLAN_CONFIG[checkoutPlan].priceFormatted}
                      </span>
                    </div>
                    <div className="pt-2 border-t-2 border-[#3A3832]">
                      <label className="block text-[11px] font-bold text-[#F5EFE6] mb-1">
                        Email nhận thông báo xác nhận nâng cấp:
                      </label>
                      <input
                        type="email"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        placeholder="nhap-email@example.com"
                        className="w-full rounded-lg border-2 border-[#F5EFE6] bg-[#141413] px-3 py-2 text-xs text-[#F5EFE6] focus:border-[#F3C969] focus:shadow-[2px_2px_0_0_#F3C969] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Simulate Payment Button */}
                  <button
                    type="button"
                    disabled={isProcessingPayment}
                    onClick={handleSimulatePaymentSuccess}
                    className={`w-full flex items-center justify-center gap-2 rounded-xl border-2 border-[#F5EFE6] py-3.5 px-5 text-xs sm:text-sm font-extrabold text-[#141413] shadow-[4px_4px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer disabled:opacity-60 ${
                      paymentMethod === "momo" ? "bg-[#FF8A8A]" : "bg-[#B8D8F8]"
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
                  <div className="w-full max-w-[260px] rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-4 text-center shadow-[4px_4px_0_0_#F5EFE6]">
                    <div className="mb-2 flex items-center justify-between text-[11px] font-extrabold">
                      <span
                        className={
                          paymentMethod === "momo"
                            ? "text-[#FF8A8A]"
                            : "text-[#B8D8F8]"
                        }
                      >
                        {paymentMethod === "momo"
                          ? "MOMO PAYMENT QR"
                          : "VNPAY SMART QR"}
                      </span>
                      <span className="text-[#F5EFE6]">
                        {PLAN_CONFIG[checkoutPlan].priceFormatted}
                      </span>
                    </div>

                    {/* White QR Frame */}
                    <div className="relative mx-auto flex h-48 w-48 items-center justify-center rounded-xl border-2 border-[#141413] bg-white p-3">
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
                        className={`absolute flex h-9 w-9 items-center justify-center rounded-lg border-2 border-white font-black text-[9px] text-white ${
                          paymentMethod === "momo"
                            ? "bg-[#A50064]"
                            : "bg-[#005BAA]"
                        }`}
                      >
                        {paymentMethod === "momo" ? "MoMo" : "VNPAY"}
                      </div>
                    </div>

                    <div className="mt-3 space-y-0.5 text-[11px]">
                      <div className="font-extrabold text-[#F5EFE6]">
                        BOOKMIND AI EDUCATION
                      </div>
                      <div className="text-[#B8B2A6]">
                        Nội dung:{" "}
                        <code className="text-[#A7D7A9] font-mono font-bold">
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
