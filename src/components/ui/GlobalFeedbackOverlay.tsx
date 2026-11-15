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
      {/* 1. UNIQUE ACTION LOADING HUD (Delete / Edit / AI API / Sync) */}
      {currentLoading && (
        <div className="fixed inset-x-0 top-16 sm:top-20 z-[90] flex justify-center px-3 pointer-events-none">
          {(() => {
            const style = VARIANT_STYLES[currentLoading.variant];
            return (
              <div
                className={`pointer-events-auto relative overflow-hidden flex items-center gap-3.5 rounded-2xl border bg-[#0B101B]/95 px-4 py-3 sm:px-5 sm:py-3.5 shadow-2xl backdrop-blur-2xl transition-all duration-200 max-w-md w-full ${style.borderGlow}`}
              >
                {/* Unique Animated Orbital Icon */}
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
                  <div
                    className={`absolute inset-0 rounded-full border-2 animate-spin ${style.ringOuter}`}
                  />
                  <div
                    className={`absolute -inset-1 rounded-full border border-dashed animate-[spin_4s_linear_infinite_reverse] ${style.ringInner}`}
                  />
                  <div
                    className={`relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg ${style.orbBg}`}
                  >
                    {renderVariantIcon(currentLoading.variant)}
                  </div>
                </div>

                {/* Task Text & Live Equalizer */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-extrabold uppercase tracking-wider ${style.accentText}`}
                    >
                      {style.badge}
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-slate-400">
                      {elapsedSec}s
                    </span>
                  </div>
                  <p className="truncate text-xs sm:text-sm font-bold text-white mt-0.5">
                    {currentLoading.title}
                  </p>
                  {currentLoading.subtitle && (
                    <p className="truncate text-[11px] text-slate-400 mt-0.5">
                      {currentLoading.subtitle}
                    </p>
                  )}
                </div>

                {/* Animated Wave Bars on the right */}
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

                {/* Bottom Shimmer Bar */}
                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-slate-800/80 overflow-hidden">
                  <div
                    className={`h-full w-2/3 animate-pulse ${style.barColor}`}
                  />
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
