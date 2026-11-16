"use client";

import React, { useState, useEffect } from "react";
import {
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  PenLine,
  X,
  Cpu,
} from "lucide-react";
import {
  ActiveLoadingItem,
  ToastNotificationItem,
  FeedbackVariant,
} from "@/lib/feedback";

const VARIANT_STYLES: Record<
  FeedbackVariant,
  {
    badge: string;
    ringOuter: string;
    ringInner: string;
    orbBg: string;
    barColor: string;
    accentText: string;
    borderGlow: string;
  }
> = {
  delete: {
    badge: "XÓA & DỌN DỮ LIỆU",
    ringOuter: "border-rose-500/45 border-t-rose-400",
    ringInner: "border-orange-500/35 border-b-rose-300",
    orbBg: "from-rose-600 to-orange-600 shadow-rose-600/35",
    barColor: "bg-gradient-to-r from-rose-500 via-orange-400 to-rose-500",
    accentText: "text-rose-300",
    borderGlow: "border-rose-500/40 shadow-rose-950/60",
  },
  edit: {
    badge: "CẬP NHẬT & LƯU TRỮ",
    ringOuter: "border-amber-500/45 border-t-amber-300",
    ringInner: "border-emerald-500/35 border-b-amber-200",
    orbBg: "from-amber-500 to-emerald-600 shadow-amber-500/35",
    barColor: "bg-gradient-to-r from-amber-400 via-emerald-400 to-amber-400",
    accentText: "text-amber-300",
    borderGlow: "border-amber-500/40 shadow-amber-950/60",
  },
  api: {
    badge: "AI AGENT ĐANG XỬ LÝ",
    ringOuter: "border-indigo-500/50 border-t-indigo-300",
    ringInner: "border-purple-500/40 border-b-cyan-300",
    orbBg: "from-indigo-600 via-violet-600 to-purple-600 shadow-indigo-600/40",
    barColor: "bg-gradient-to-r from-indigo-500 via-purple-400 to-cyan-400",
    accentText: "text-indigo-300",
    borderGlow: "border-indigo-500/45 shadow-indigo-950/70",
  },
  sync: {
    badge: "ĐỒNG BỘ CLOUD",
    ringOuter: "border-emerald-500/45 border-t-emerald-300",
    ringInner: "border-cyan-500/35 border-b-emerald-200",
    orbBg: "from-emerald-600 to-teal-600 shadow-emerald-600/35",
    barColor: "bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400",
    accentText: "text-emerald-300",
    borderGlow: "border-emerald-500/40 shadow-emerald-950/60",
  },
};

export default function GlobalFeedbackOverlay() {
  const [loadingStack, setLoadingStack] = useState<ActiveLoadingItem[]>([]);
  const [toasts, setToasts] = useState<ToastNotificationItem[]>([]);
  const [elapsedSec, setElapsedSec] = useState<string>("0.1");

  useEffect(() => {
    const handleLoading = (e: Event) => {
      const custom = e as CustomEvent<{
        action: "start" | "stop";
        item?: ActiveLoadingItem;
        id?: string;
      }>;
      if (!custom.detail) return;
      if (custom.detail.action === "start" && custom.detail.item) {
        const newItem = custom.detail.item;
        setLoadingStack((prev) => [
          ...prev.filter((x) => x.id !== newItem.id),
          newItem,
        ]);
      } else if (custom.detail.action === "stop") {
        const targetId = custom.detail.id;
        setLoadingStack((prev) =>
          targetId ? prev.filter((x) => x.id !== targetId) : []
        );
      }
    };

    const handleToast = (e: Event) => {
      const custom = e as CustomEvent<ToastNotificationItem>;
      if (!custom.detail) return;
      const newToast = custom.detail;
      setToasts((prev) => [newToast, ...prev].slice(0, 3));

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, newToast.durationMs);
    };

    window.addEventListener("bookmind:action-loading", handleLoading);
    window.addEventListener("bookmind:toast", handleToast);
    return () => {
      window.removeEventListener("bookmind:action-loading", handleLoading);
      window.removeEventListener("bookmind:toast", handleToast);
    };
  }, []);

  const currentLoading =
    loadingStack.length > 0 ? loadingStack[loadingStack.length - 1] : null;

  useEffect(() => {
    if (!currentLoading) {
      setElapsedSec("0.1");
      return;
    }
    const interval = setInterval(() => {
      const diff = Math.max(0.1, (Date.now() - currentLoading.startedAt) / 1000);
      setElapsedSec(diff.toFixed(1));
    }, 100);
    return () => clearInterval(interval);
  }, [currentLoading]);

  const renderVariantIcon = (variant: FeedbackVariant) => {
    switch (variant) {
      case "delete":
        return <Trash2 className="h-5 w-5 text-white animate-bounce" />;
      case "edit":
        return <PenLine className="h-5 w-5 text-white animate-pulse" />;
      case "sync":
        return <RefreshCw className="h-5 w-5 text-white animate-spin" />;
      case "api":
      default:
        return <Cpu className="h-5 w-5 text-white animate-pulse" />;
    }
  };

  return (
    <>
      {/* 1. FULL-SCREEN FOCUS LOCK MODAL (Delete / Edit / AI API / Sync) */}
      {currentLoading && (
        <div
          role="dialog"
          aria-modal="true"
          aria-busy="true"
          aria-label={currentLoading.title}
          className="fixed inset-0 z-[95] flex items-center justify-center bg-[#060911]/80 backdrop-blur-md p-4 pointer-events-auto select-none animate-in fade-in duration-200"
        >
          {(() => {
            const style = VARIANT_STYLES[currentLoading.variant];
            const STEP_MESSAGES: Record<FeedbackVariant, string[]> = {
              api: [
                "Đang kết nối bộ định tuyến AI & phân tích ngữ cảnh...",
                "Đang xử lý học liệu chuyên sâu theo chuẩn sư phạm...",
                "Đang chuẩn hóa cấu trúc dữ liệu & hoàn tất phản hồi...",
              ],
              sync: [
                "Đang thiết lập kết nối an toàn tới Supabase Cloud...",
                "Đang đồng bộ dữ liệu hai chiều giữa thiết bị & kho lưu trữ...",
                "Đang xác thực toàn vẹn dữ liệu đồng bộ...",
              ],
              delete: [
                "Đang xác minh quyền sở hữu & dọn dẹp dữ liệu cục bộ...",
                "Đang gỡ bỏ tệp lưu trữ trên Supabase Kho A & Kho B...",
                "Đang làm mới lại tủ sách & bộ nhớ đệm...",
              ],
              edit: [
                "Đang kiểm tra thay đổi & cập nhật cấu trúc dữ liệu...",
                "Đang lưu bản cập nhật vào IndexedDB & Cloud...",
                "Đang đồng bộ hiển thị giao diện...",
              ],
            };
            const steps = STEP_MESSAGES[currentLoading.variant] || STEP_MESSAGES.api;
            const elapsedNum = Number.parseFloat(String(elapsedSec)) || 0;
            const stepIndex = Math.floor(elapsedNum / 3) % steps.length;

            return (
              <div
                className={`relative overflow-hidden rounded-3xl border bg-[#0B101B]/95 p-6 sm:p-7 shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200 ${style.borderGlow}`}
              >
                {/* Top Status Row: Orbital Icon + Badge + Timer */}
                <div className="flex items-start gap-4">
                  {/* Unique Animated Orbital Icon */}
                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
                    <div
                      className={`absolute inset-0 rounded-full border-2 animate-spin ${style.ringOuter}`}
                    />
                    <div
                      className={`absolute -inset-1.5 rounded-full border border-dashed animate-[spin_4s_linear_infinite_reverse] ${style.ringInner}`}
                    />
                    <div
                      className={`relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg ${style.orbBg}`}
                    >
                      {renderVariantIcon(currentLoading.variant)}
                    </div>
                  </div>

                  {/* Title, Badge & Live Timer */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider ${style.accentText}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full animate-ping ${style.barColor}`} />
                        {style.badge}
                      </span>
                      <span className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] font-bold text-slate-300 tabular-nums">
                        {elapsedSec}s
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-white mt-1.5 leading-snug">
                      {currentLoading.title}
                    </h3>
                    {currentLoading.subtitle && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {currentLoading.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {/* Dynamic 3s Step Message & Animated Wave Bars */}
                <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5">
                  <p className="text-[11px] sm:text-xs font-medium text-slate-300 leading-relaxed">
                    {steps[stepIndex]}
                  </p>
                  <div className="flex items-end gap-0.5 h-4 shrink-0 pl-1">
                    <span
                      className={`w-1 h-2 rounded-full animate-[bounce_0.7s_infinite_100ms] ${style.barColor}`}
                    />
                    <span
                      className={`w-1 h-4 rounded-full animate-[bounce_0.7s_infinite_250ms] ${style.barColor}`}
                    />
                    <span
                      className={`w-1 h-2.5 rounded-full animate-[bounce_0.7s_infinite_400ms] ${style.barColor}`}
                    />
                  </div>
                </div>

                {/* Smooth Shimmer Progress Track */}
                <div className="mt-4 h-1.5 w-full rounded-full bg-slate-800/90 overflow-hidden">
                  <div
                    className={`h-full w-2/5 rounded-full bm-shimmer-bar ${style.barColor}`}
                  />
                </div>

                {/* Safety Focus Lock Notice */}
                <div className="mt-3.5 flex items-center justify-center gap-2 text-[11px] text-slate-400">
                  <svg
                    className="h-3.5 w-3.5 shrink-0 text-amber-400/90"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>Đang khóa thao tác tạm thời để đảm bảo an toàn dữ liệu</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 2. AUTO-DISMISSING TOAST NOTIFICATIONS (1.8s Auto-Close) */}
      {toasts.length > 0 && (
        <div className="fixed top-3 right-3 left-3 sm:left-auto sm:top-5 sm:right-5 z-[100] flex flex-col gap-2 sm:w-88 pointer-events-none">
          {toasts.map((t) => {
            const isError = t.type === "error";
            const isDelete = t.type === "delete";
            const isInfo = t.type === "info";

            const borderClass = isError
              ? "border-rose-500/50 bg-[#180C12]/95 text-rose-100 shadow-rose-950/50"
              : isDelete
              ? "border-amber-500/45 bg-[#17110B]/95 text-amber-100 shadow-amber-950/50"
              : isInfo
              ? "border-indigo-500/45 bg-[#0D1322]/95 text-indigo-100 shadow-indigo-950/50"
              : "border-emerald-500/45 bg-[#0B1714]/95 text-emerald-100 shadow-emerald-950/50";

            const barClass = isError
              ? "bg-rose-500"
              : isDelete
              ? "bg-amber-400"
              : isInfo
              ? "bg-indigo-400"
              : "bg-emerald-400";

            return (
              <div
                key={t.id}
                className={`pointer-events-auto relative overflow-hidden flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 ${borderClass}`}
              >
                <div className="mt-0.5 shrink-0">
                  {isError ? (
                    <AlertCircle className="h-4.5 w-4.5 text-rose-400" />
                  ) : isDelete ? (
                    <Trash2 className="h-4.5 w-4.5 text-amber-400" />
                  ) : isInfo ? (
                    <Sparkles className="h-4.5 w-4.5 text-indigo-400" />
                  ) : (
                    <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-bold text-white leading-snug">
                    {t.title}
                  </p>
                  {t.message && (
                    <p className="mt-0.5 text-[11px] text-slate-300 leading-relaxed line-clamp-2">
                      {t.message}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setToasts((prev) => prev.filter((item) => item.id !== t.id))
                  }
                  className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition cursor-pointer shrink-0"
                  aria-label="Đóng thông báo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>

                {/* Auto-dismiss shrinking bar (1.8s) */}
                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/10">
                  <div
                    className={`h-full ${barClass}`}
                    style={{
                      width: "100%",
                      animation: `bookmindToastShrink ${t.durationMs}ms linear forwards`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
