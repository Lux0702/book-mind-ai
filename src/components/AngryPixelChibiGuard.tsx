"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Flame, CheckCircle2, Sparkles } from "lucide-react";
import { recordLearningActivity } from "@/lib/storage";
import { useAppData } from "@/components/app/AppDataProvider";

const ANGRY_LINES = [
  "Hôm qua trốn học đi đâu hả?!",
  "Cào nát màn hình giờ!! Điểm danh mau!!",
  "Đứt chuỗi học rồi kìa! Bấm Điểm Danh ngay!",
  "Không điểm danh là cào tới sáng luôn đó!!",
];

function getLocalDateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Pixel-Art Chibi Mascot (16x16 grid, crispEdges)
 * mood="angry": furrowed brows, puff cheeks, angry vein, flailing clawing paws
 * mood="happy": ^ ^ eyes, rosy blush, bouncing with pixel hearts
 */
function PixelChibiSprite({ mood }: { mood: "angry" | "happy" }) {
  return (
    <div className="relative flex h-24 w-24 items-center justify-center select-none">
      {/* Ground pixel shadow */}
      <div
        className={`absolute bottom-1 h-2.5 w-14 rounded-full bg-black/50 blur-[1px] ${
          mood === "angry" ? "bm-chibi-shadow" : ""
        }`}
      />

      {/* Angry pixel claw slashes swiping the air */}
      {mood === "angry" && (
        <svg
          viewBox="0 0 24 24"
          shapeRendering="crispEdges"
          className="pointer-events-none absolute -right-3 top-2 h-12 w-12 bm-claw-slash"
          aria-hidden="true"
        >
          {/* 3 diagonal pixel claw marks */}
          <rect x="16" y="2" width="2" height="2" fill="#fb7185" />
          <rect x="14" y="4" width="2" height="2" fill="#f43f5e" />
          <rect x="12" y="6" width="2" height="2" fill="#f43f5e" />
          <rect x="10" y="8" width="2" height="2" fill="#fda4af" />

          <rect x="20" y="5" width="2" height="2" fill="#fb7185" />
          <rect x="18" y="7" width="2" height="2" fill="#f43f5e" />
          <rect x="16" y="9" width="2" height="2" fill="#f43f5e" />
          <rect x="14" y="11" width="2" height="2" fill="#fda4af" />

          <rect x="21" y="10" width="2" height="2" fill="#fbbf24" />
          <rect x="19" y="12" width="2" height="2" fill="#f59e0b" />
          <rect x="17" y="14" width="2" height="2" fill="#fb7185" />
        </svg>
      )}

      {/* Floating pixel hearts when happy */}
      {mood === "happy" && (
        <svg
          viewBox="0 0 20 12"
          shapeRendering="crispEdges"
          className="pointer-events-none absolute -top-2 inset-x-0 mx-auto h-7 w-14 animate-bounce"
          aria-hidden="true"
        >
          {/* Left mini pixel heart */}
          <rect x="2" y="2" width="2" height="2" fill="#fb7185" />
          <rect x="6" y="2" width="2" height="2" fill="#fb7185" />
          <rect x="2" y="4" width="6" height="2" fill="#f43f5e" />
          <rect x="4" y="6" width="2" height="2" fill="#f43f5e" />
          {/* Right mini pixel heart */}
          <rect x="13" y="1" width="2" height="2" fill="#fbbf24" />
          <rect x="17" y="1" width="2" height="2" fill="#fbbf24" />
          <rect x="13" y="3" width="6" height="2" fill="#f59e0b" />
          <rect x="15" y="5" width="2" height="2" fill="#f59e0b" />
        </svg>
      )}

      {/* Main 16x16 Pixel Chibi Character */}
      <svg
        viewBox="0 0 16 16"
        shapeRendering="crispEdges"
        className={`h-20 w-20 drop-shadow-[0_6px_12px_rgba(0,0,0,0.5)] ${
          mood === "angry" ? "bm-chibi-jump" : "bm-chibi-happy"
        }`}
        role="img"
        aria-label={mood === "angry" ? "Pixel Chibi đang giận dữ" : "Pixel Chibi vui vẻ"}
      >
        {/* Pixel anger vein mark (top-left of head) */}
        {mood === "angry" && (
          <g className="bm-anger-vein">
            <rect x="1" y="1" width="1" height="2" fill="#ef4444" />
            <rect x="2" y="2" width="1" height="1" fill="#ef4444" />
            <rect x="3" y="1" width="1" height="2" fill="#ef4444" />
            <rect x="1" y="4" width="1" height="1" fill="#ef4444" />
            <rect x="3" y="4" width="1" height="1" fill="#ef4444" />
          </g>
        )}

        {/* Cat-hoodie chibi ears */}
        <rect x="3" y="1" width="2" height="2" fill="#312e81" />
        <rect x="4" y="2" width="1" height="1" fill="#f472b6" />
        <rect x="11" y="1" width="2" height="2" fill="#312e81" />
        <rect x="11" y="2" width="1" height="1" fill="#f472b6" />

        {/* Hair / Hoodie Outline */}
        <rect x="3" y="3" width="10" height="7" fill="#312e81" />
        <rect x="2" y="4" width="12" height="5" fill="#4338ca" />
        {/* Hair highlight */}
        <rect x="4" y="3" width="8" height="1" fill="#6366f1" />

        {/* Face Skin */}
        <rect x="4" y="5" width="8" height="5" fill="#fde6d0" />
        <rect x="3" y="6" width="10" height="3" fill="#fde6d0" />
        {/* Bangs */}
        <rect x="4" y="4" width="2" height="1" fill="#312e81" />
        <rect x="7" y="4" width="3" height="2" fill="#312e81" />
        <rect x="11" y="4" width="1" height="1" fill="#312e81" />

        {/* Expression */}
        {mood === "angry" ? (
          <>
            {/* Furrowed angry eyebrows */}
            <rect x="4" y="5" width="2" height="1" fill="#1e1b4b" />
            <rect x="6" y="6" width="1" height="1" fill="#1e1b4b" />
            <rect x="10" y="5" width="2" height="1" fill="#1e1b4b" />
            <rect x="9" y="6" width="1" height="1" fill="#1e1b4b" />
            {/* Glowing angry eyes */}
            <rect x="5" y="7" width="1" height="1" fill="#dc2626" />
            <rect x="10" y="7" width="1" height="1" fill="#dc2626" />
            {/* Flushed angry cheeks */}
            <rect x="3" y="8" width="2" height="1" fill="#fb7185" />
            <rect x="11" y="8" width="2" height="1" fill="#fb7185" />
            {/* Shouting open pixel mouth */}
            <rect x="7" y="8" width="2" height="2" fill="#991b1b" />
            <rect x="7" y="8" width="2" height="1" fill="#ffffff" />
          </>
        ) : (
          <>
            {/* Happy ^ ^ eyes */}
            <rect x="5" y="6" width="1" height="1" fill="#1e1b4b" />
            <rect x="4" y="7" width="1" height="1" fill="#1e1b4b" />
            <rect x="6" y="7" width="1" height="1" fill="#1e1b4b" />
            <rect x="10" y="6" width="1" height="1" fill="#1e1b4b" />
            <rect x="9" y="7" width="1" height="1" fill="#1e1b4b" />
            <rect x="11" y="7" width="1" height="1" fill="#1e1b4b" />
            {/* Rosy happy cheeks */}
            <rect x="4" y="8" width="1" height="1" fill="#fb7185" />
            <rect x="11" y="8" width="1" height="1" fill="#fb7185" />
            {/* Happy smile */}
            <rect x="7" y="8" width="2" height="1" fill="#be123c" />
          </>
        )}

        {/* Chibi Body / Hoodie */}
        <rect x="5" y="10" width="6" height="4" fill="#4f46e5" />
        <rect x="6" y="10" width="4" height="3" fill="#6366f1" />
        {/* Scarf / Collar accent */}
        <rect x="5" y="10" width="6" height="1" fill="#f59e0b" />

        {/* Animated Left Paw (clawing) */}
        <g className={mood === "angry" ? "bm-chibi-arm-l" : ""}>
          <rect x="2" y="10" width="3" height="2" fill="#fde6d0" />
          {mood === "angry" && (
            <rect x="1" y="10" width="1" height="2" fill="#ffffff" />
          )}
        </g>

        {/* Animated Right Paw (clawing) */}
        <g className={mood === "angry" ? "bm-chibi-arm-r" : ""}>
          <rect x="11" y="10" width="3" height="2" fill="#fde6d0" />
          {mood === "angry" && (
            <rect x="14" y="10" width="1" height="2" fill="#ffffff" />
          )}
        </g>

        {/* Feet */}
        <rect x="5" y="14" width="2" height="1" fill="#1e1b4b" />
        <rect x="9" y="14" width="2" height="1" fill="#1e1b4b" />
      </svg>
    </div>
  );
}

export default function AngryPixelChibiGuard() {
  const { streakData, isLoading } = useAppData();
  const [lineIndex, setLineIndex] = useState(0);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const { isCheckedInToday, missedYesterday } = useMemo(() => {
    const todayStr = getLocalDateStr(0);
    const yesterdayStr = getLocalDateStr(-1);
    const dates = streakData?.activeDates || [];
    return {
      isCheckedInToday: dates.includes(todayStr),
      missedYesterday: !dates.includes(yesterdayStr),
    };
  }, [streakData]);

  const shouldShowAngry =
    !isLoading &&
    (previewMode || (!isCheckedInToday && missedYesterday));

  const isVisible = shouldShowAngry || celebrating;

  // Rotate angry pixel speech lines every 3.2s
  useEffect(() => {
    if (!shouldShowAngry || celebrating) return;
    const id = setInterval(() => {
      setLineIndex((prev) => (prev + 1) % ANGRY_LINES.length);
    }, 3200);
    return () => clearInterval(id);
  }, [shouldShowAngry, celebrating]);

  // Allow manual preview trigger from AttendanceDashboard for testing
  useEffect(() => {
    const onPreview = () => {
      setCelebrating(false);
      setPreviewMode(true);
    };
    window.addEventListener("bookmind:preview-chibi", onPreview);
    return () => {
      window.removeEventListener("bookmind:preview-chibi", onPreview);
    };
  }, []);

  const handleCheckInNow = async () => {
    if (isCheckingIn) return;
    setIsCheckingIn(true);
    try {
      if (!isCheckedInToday) {
        await recordLearningActivity({
          type: "check_in",
          title: "Điểm danh hàng ngày",
          details:
            "Đã điểm danh dỗ Pixel Chibi và khởi động lại chuỗi ngày học.",
        });
      }
      setPreviewMode(false);
      setCelebrating(true);
      setTimeout(() => {
        setCelebrating(false);
      }, 2200);
    } finally {
      setIsCheckingIn(false);
    }
  };

  if (!isVisible) return null;

  const mood: "angry" | "happy" = celebrating ? "happy" : "angry";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 right-3 sm:right-5 lg:bottom-5 z-[60] max-w-[calc(100vw-1.5rem)] w-[330px] sm:w-[355px] animate-in fade-in slide-in-from-bottom-5 duration-200"
    >
      <div
        className={`relative overflow-hidden rounded-2xl border-2 p-3.5 shadow-2xl backdrop-blur-xl transition-colors ${
          mood === "angry"
            ? "border-rose-500/70 bg-[#120B16]/95 shadow-rose-950/60"
            : "border-emerald-500/60 bg-[#0B1715]/95 shadow-emerald-950/60"
        }`}
      >
        {/* Pixel corner decorations */}
        <span
          className={`pointer-events-none absolute left-1.5 top-1.5 h-1.5 w-1.5 ${
            mood === "angry" ? "bg-rose-400" : "bg-emerald-400"
          }`}
        />
        <span
          className={`pointer-events-none absolute right-1.5 top-1.5 h-1.5 w-1.5 ${
            mood === "angry" ? "bg-amber-400" : "bg-emerald-400"
          }`}
        />

        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <PixelChibiSprite mood={mood} />
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center justify-between gap-1.5">
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider ${
                  mood === "angry"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                }`}
              >
                {mood === "angry" ? "💢 BỎ HỌC HÔM QUA!" : "✨ ĐÃ ĐIỂM DANH!"}
              </span>
              {previewMode && mood === "angry" && (
                <button
                  type="button"
                  onClick={() => setPreviewMode(false)}
                  className="text-[10px] font-semibold text-slate-400 hover:text-white cursor-pointer"
                >
                  Đóng thử
                </button>
              )}
            </div>

            {/* Speech Bubble */}
            <div
              className={`rounded-xl border px-2.5 py-2 text-xs font-bold leading-snug ${
                mood === "angry"
                  ? "border-rose-500/30 bg-rose-950/40 text-rose-100"
                  : "border-emerald-500/30 bg-emerald-950/40 text-emerald-100"
              }`}
            >
              {mood === "angry"
                ? ANGRY_LINES[lineIndex]
                : "Hì hì! Ngoan lắm, tha cho lần này nha! Tiếp tục học nào!"}
            </div>

            {mood === "angry" ? (
              <button
                type="button"
                disabled={isCheckingIn}
                onClick={handleCheckInNow}
                className="flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 px-3 py-2 text-xs font-extrabold text-white shadow-lg shadow-rose-900/40 transition hover:from-rose-500 hover:to-amber-400 active:scale-95 disabled:opacity-60 cursor-pointer"
              >
                <Flame className="h-3.5 w-3.5 fill-current" />
                <span>
                  {isCheckingIn
                    ? "Đang điểm danh..."
                    : isCheckedInToday
                    ? "Dỗ Chibi ngay!"
                    : "Điểm danh ngay để dỗ Chibi"}
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>Đã ghi nhận chuỗi học hôm nay</span>
                <Sparkles className="h-3 w-3 text-amber-300" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
