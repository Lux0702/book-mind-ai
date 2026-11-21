"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Flame, CheckCircle2, Sparkles, PartyPopper, Music } from "lucide-react";
import { recordLearningActivity } from "@/lib/storage";
import { ChibiCelebrateDetail } from "@/lib/chibiEvents";
import { useAppData } from "@/components/app/AppDataProvider";
import PixelChibiArt from "@/components/PixelChibiArt";

const ANGRY_LINES = [
  "Hôm qua trốn học đi đâu hả?!",
  "Cào nát màn hình giờ!! Điểm danh mau!!",
  "Đứt chuỗi học rồi kìa! Bấm Điểm Danh ngay!",
  "Không điểm danh là cào tới sáng luôn đó!!",
];

const PARTY_CHANTS = [
  "LA LA LA~ ♫ Giỏi xuất sắc quá trời ơi!! 🎉",
  "WOOHOO!! Đỉnh của chóp! Quẩy lên nào!! 🎵✨",
  "HOAN HÔ!! Siêu nhân học tập đây rồi!! 🏆🎶",
];

function getLocalDateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type ChibiMood = "angry" | "happy" | "party";

/**
 * Pixel-Art Chibi Mascot (16x16 grid, crispEdges)
 * - angry: furrowed brows, anger vein, flailing clawing paws + pixel claw slashes
 * - happy: ^ ^ eyes, rosy cheeks, floating pixel hearts (after check-in)
 * - party: party hat, waving raised arms, singing open happy mouth, floating ♪ ♫ & confetti
 */
function PixelChibiSprite({ mood }: { mood: ChibiMood }) {
  return (
    <div className="relative mx-auto flex h-44 w-44 sm:h-48 sm:w-48 items-center justify-center select-none">
      {/* Ground pixel shadow */}
      <div
        className={`absolute bottom-2 h-4 w-28 rounded-full bg-black/55 blur-[2px] ${
          mood === "angry" || mood === "party" ? "bm-chibi-shadow" : ""
        }`}
      />

      {/* Angry pixel claw slashes swiping the air */}
      {mood === "angry" && (
        <svg
          viewBox="0 0 24 24"
          shapeRendering="crispEdges"
          className="pointer-events-none absolute -right-4 top-3 h-20 w-20 bm-claw-slash"
          aria-hidden="true"
        >
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
          className="pointer-events-none absolute -top-3 inset-x-0 mx-auto h-12 w-24 animate-bounce"
          aria-hidden="true"
        >
          <rect x="2" y="2" width="2" height="2" fill="#fb7185" />
          <rect x="6" y="2" width="2" height="2" fill="#fb7185" />
          <rect x="2" y="4" width="6" height="2" fill="#f43f5e" />
          <rect x="4" y="6" width="2" height="2" fill="#f43f5e" />
          <rect x="13" y="1" width="2" height="2" fill="#fbbf24" />
          <rect x="17" y="1" width="2" height="2" fill="#fbbf24" />
          <rect x="13" y="3" width="6" height="2" fill="#f59e0b" />
          <rect x="15" y="5" width="2" height="2" fill="#f59e0b" />
        </svg>
      )}

      {/* Party mode: Floating pixel music notes ♪ ♫ & confetti bursts */}
      {mood === "party" && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-2 top-1 font-mono text-2xl font-black text-amber-300 bm-music-float-1"
          >
            ♪
          </span>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-2 top-2 font-mono text-2xl font-black text-pink-400 bm-music-float-2"
          >
            ♫
          </span>
          <svg
            viewBox="0 0 24 24"
            shapeRendering="crispEdges"
            className="pointer-events-none absolute inset-0 h-full w-full bm-confetti-pop"
            aria-hidden="true"
          >
            <rect x="2" y="4" width="2" height="2" fill="#fbbf24" />
            <rect x="20" y="3" width="2" height="2" fill="#34d399" />
            <rect x="1" y="14" width="2" height="2" fill="#f472b6" />
            <rect x="21" y="13" width="2" height="2" fill="#60a5fa" />
            <rect x="6" y="1" width="2" height="2" fill="#a78bfa" />
            <rect x="16" y="1" width="2" height="2" fill="#fb7185" />
          </svg>
        </>
      )}

      {/* Main 32x32 High-Detail Pixel Chibi Character */}
      <PixelChibiArt
        mood={mood}
        className={`h-40 w-40 sm:h-44 sm:w-44 ${
          mood === "angry"
            ? "bm-chibi-jump"
            : mood === "party"
            ? "bm-chibi-party-jump"
            : "bm-chibi-happy"
        }`}
      />
    </div>
  );
}

export default function AngryPixelChibiGuard() {
  const { streakData, isLoading } = useAppData();
  const [lineIndex, setLineIndex] = useState(0);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [celebratingCheckIn, setCelebratingCheckIn] = useState(false);
  const [previewAngry, setPreviewAngry] = useState(false);
  const [partyState, setPartyState] = useState<ChibiCelebrateDetail | null>(
    null
  );
  const partyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    !partyState &&
    (previewAngry || (!isCheckedInToday && missedYesterday));

  const isVisible = Boolean(partyState) || shouldShowAngry || celebratingCheckIn;

  // Rotate angry lines or party singing chants
  useEffect(() => {
    if (!shouldShowAngry && !partyState) return;
    const intervalMs = partyState ? 2200 : 3200;
    const id = setInterval(() => {
      setLineIndex((prev) => prev + 1);
    }, intervalMs);
    return () => clearInterval(id);
  }, [shouldShowAngry, partyState]);

  // Listen for preview-angry and celebrate events
  useEffect(() => {
    const onPreviewAngry = () => {
      setPartyState(null);
      setCelebratingCheckIn(false);
      setPreviewAngry(true);
    };

    const onCelebrate = (e: Event) => {
      const detail = (e as CustomEvent<ChibiCelebrateDetail>).detail || {};
      if (partyTimerRef.current) clearTimeout(partyTimerRef.current);
      setPreviewAngry(false);
      setCelebratingCheckIn(false);
      setLineIndex(0);
      setPartyState(detail);
      const duration = detail.durationMs ?? 6000;
      partyTimerRef.current = setTimeout(() => {
        setPartyState(null);
      }, duration);
    };

    window.addEventListener("bookmind:preview-chibi", onPreviewAngry);
    window.addEventListener("bookmind:chibi-celebrate", onCelebrate);
    return () => {
      if (partyTimerRef.current) clearTimeout(partyTimerRef.current);
      window.removeEventListener("bookmind:preview-chibi", onPreviewAngry);
      window.removeEventListener("bookmind:chibi-celebrate", onCelebrate);
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
      setPreviewAngry(false);
      setCelebratingCheckIn(true);
      setTimeout(() => {
        setCelebratingCheckIn(false);
      }, 2200);
    } finally {
      setIsCheckingIn(false);
    }
  };

  if (!isVisible) return null;

  const mood: ChibiMood = partyState
    ? "party"
    : celebratingCheckIn
    ? "happy"
    : "angry";

  const partyMessage =
    partyState?.message && lineIndex % 2 === 0
      ? partyState.message
      : PARTY_CHANTS[lineIndex % PARTY_CHANTS.length];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      onClick={() => {
        if (mood === "party") {
          if (partyTimerRef.current) clearTimeout(partyTimerRef.current);
          setPartyState(null);
        } else if (previewAngry && mood === "angry") {
          setPreviewAngry(false);
        }
      }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#141413]/85 p-4 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative overflow-hidden rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-6 sm:p-7 shadow-[6px_6px_0_0_#F5EFE6] w-full max-w-sm sm:max-w-md text-center animate-in zoom-in-95 duration-200"
      >
        {/* Top Badge Row */}
        <div className="flex items-center justify-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border-2 border-[#F5EFE6] px-3.5 py-1 font-mono text-xs font-extrabold uppercase tracking-wider text-[#141413] shadow-[2px_2px_0_0_#F5EFE6] ${
              mood === "party"
                ? "bg-[#F3C969]"
                : mood === "angry"
                ? "bg-[#FF8A8A]"
                : "bg-[#A7D7A9]"
            }`}
          >
            {mood === "party"
              ? partyState?.badge || "🎉 CHIBI KHEN NGỢI!"
              : mood === "angry"
              ? "💢 BỎ HỌC HÔM QUA!"
              : "✨ ĐÃ ĐIỂM DANH!"}
          </span>
        </div>

        {/* Big Centered Pixel Chibi Stage */}
        <div className="my-4">
          <PixelChibiSprite mood={mood} />
        </div>

        {/* Speech Bubble */}
        <div className="rounded-xl border-2 border-[#3A3832] bg-[#141413] px-4 py-3 text-sm sm:text-base font-bold leading-snug text-[#F5EFE6]">
          {mood === "party"
            ? partyMessage
            : mood === "angry"
            ? ANGRY_LINES[lineIndex % ANGRY_LINES.length]
            : "Hì hì! Ngoan lắm, tha cho lần này nha! Tiếp tục học nào!"}
        </div>

        {mood === "party" && partyState?.subtext && (
          <p className="mt-2.5 flex items-center justify-center gap-1.5 text-xs font-bold text-[#C8B6FF]">
            <Music className="h-3.5 w-3.5 shrink-0 text-[#F3C969]" />
            <span>{partyState.subtext}</span>
          </p>
        )}

        {/* Action Button */}
        <div className="mt-5 space-y-2.5">
          {mood === "angry" ? (
            <>
              <button
                type="button"
                disabled={isCheckingIn}
                onClick={handleCheckInNow}
                className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-4 py-2.5 text-sm font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform hover:bg-[#f7d683] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] disabled:opacity-60 cursor-pointer"
              >
                <Flame className="h-4 w-4 fill-current" />
                <span>
                  {isCheckingIn
                    ? "Đang điểm danh..."
                    : isCheckedInToday
                    ? "Dỗ Chibi ngay!"
                    : "Điểm danh ngay để dỗ Chibi"}
                </span>
              </button>
              {previewAngry && (
                <button
                  type="button"
                  onClick={() => setPreviewAngry(false)}
                  className="w-full py-1.5 text-xs font-bold text-[#B8B2A6] hover:text-[#F5EFE6] cursor-pointer"
                >
                  Đóng xem thử
                </button>
              )}
            </>
          ) : mood === "party" ? (
            <button
              type="button"
              onClick={() => {
                if (partyTimerRef.current) clearTimeout(partyTimerRef.current);
                setPartyState(null);
              }}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-4 py-2.5 text-sm font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform hover:bg-[#b8e2ba] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
            >
              <PartyPopper className="h-4 w-4" />
              <span>Cảm ơn Chibi! Tiếp tục học ✨</span>
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 py-1 text-xs font-bold text-[#A7D7A9]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Đã ghi nhận chuỗi học hôm nay</span>
              <Sparkles className="h-3.5 w-3.5 text-[#F3C969]" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
