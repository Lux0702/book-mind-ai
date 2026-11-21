"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  CheckCircle2,
  Gift,
  Sparkles,
  Lock,
  ArrowRight,
  Star,
} from "lucide-react";
import {
  Course,
  FlashcardSRS,
  LearningActivity,
  StudyStreak,
} from "@/types/course";
import {
  CHIBI_TIERS,
  ChibiTier,
  claimDailyQuestBonusToday,
  computeChibiProgression,
  getClaimedDailyQuestDates,
} from "@/lib/chibiEvolution";
import { triggerChibiCelebrate } from "@/lib/chibiEvents";
import PixelChibiArt from "@/components/PixelChibiArt";

interface ChibiDailyQuestCardProps {
  streak: StudyStreak;
  activities: LearningActivity[];
  courses: Course[];
  flashcards: FlashcardSRS[];
  onCheckIn: () => void;
  onOpenSrs: () => void;
  onOpenFirstCourse: () => void;
}

const PET_QUOTES = [
  "Hehe nhột quá! Hôm nay học thêm vài từ nhé~ ✨",
  "Đừng để đứt chuỗi Streak nha, mình tin bạn làm được! 🔥",
  "Cố lên! Hoàn thành 3/3 nhiệm vụ để mở rương +50 XP nào! 🎁",
  "Ôn Flashcard 5 phút mỗi ngày là nhớ lâu cực kỳ luôn! 📚",
  "Bạn xoa đầu là mình có thêm sức mạnh tiến hóa đó! 💪",
];

/**
 * High-Detail 32x32 Pixel-Art Chibi with dynamic Evolution Accessories
 */
function EvolvingPixelChibi({
  tierId,
  isBouncing,
}: {
  tierId: ChibiTier["id"];
  isBouncing: boolean;
}) {
  return (
    <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-xl border-2 border-[#F5EFE6] bg-[#141413] select-none overflow-visible">
      <PixelChibiArt
        mood={isBouncing ? "happy" : "idle"}
        tierId={tierId}
        className={`h-24 w-24 transition-transform duration-150 ${
          isBouncing ? "-translate-y-2 scale-105" : ""
        }`}
      />

      {/* Sparkle star for Lv.4 & Lv.5 */}
      {(tierId === "professor" || tierId === "royal") && (
        <span className="pointer-events-none absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#141413] bg-[#F3C969] text-[#141413]">
          <Star className="h-3.5 w-3.5 fill-[#141413]" />
        </span>
      )}
    </div>
  );
}

export default function ChibiDailyQuestCard({
  streak,
  activities,
  courses,
  flashcards,
  onCheckIn,
  onOpenSrs,
  onOpenFirstCourse,
}: ChibiDailyQuestCardProps) {
  const [claimedDates, setClaimedDates] = useState<string[]>([]);
  const [petBounce, setPetBounce] = useState(false);
  const [petQuote, setPetQuote] = useState<string | null>(null);

  useEffect(() => {
    setClaimedDates(getClaimedDailyQuestDates());
  }, []);

  const state = useMemo(
    () =>
      computeChibiProgression({
        streak,
        activities,
        courses,
        flashcards,
        claimedDates,
      }),
    [streak, activities, courses, flashcards, claimedDates]
  );

  const handlePetChibi = () => {
    setPetBounce(true);
    const randomLine = PET_QUOTES[Math.floor(Math.random() * PET_QUOTES.length)];
    setPetQuote(randomLine);
    setTimeout(() => setPetBounce(false), 450);
  };

  const handleClaimDailyChest = () => {
    if (!state.allQuestsDone || state.bonusClaimedToday) return;
    const updated = claimDailyQuestBonusToday();
    setClaimedDates(updated);
    triggerChibiCelebrate({
      badge: "🎁 RƯƠNG NHIỆM VỤ 3/3 (+50 XP)!",
      message: `WOOHOO!! Bạn đã hoàn thành sạch 3/3 nhiệm vụ hôm nay! ${state.tier.title} đang mạnh lên từng ngày!! 🎵🎉`,
      subtext: `Tổng kinh nghiệm hiện tại: ${state.totalXp + 50} XP`,
    });
  };

  const handleQuestAction = (questId: "check_in" | "vocab_review" | "study_practice") => {
    if (questId === "check_in") {
      onCheckIn();
    } else if (questId === "vocab_review") {
      onOpenSrs();
    } else {
      onOpenFirstCourse();
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      {/* LEFT: PIXEL CHIBI EVOLUTION PANEL */}
      <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-5 shadow-[4px_4px_0_0_#F5EFE6] space-y-4">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={handlePetChibi}
            title="Bấm để xoa đầu Chibi!"
            className="cursor-pointer transition-transform active:scale-95 focus:outline-none"
          >
            <EvolvingPixelChibi tierId={state.tier.id} isBouncing={petBounce} />
          </button>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1 rounded-full border-2 border-[#141413] px-2.5 py-0.5 text-[11px] font-black text-[#141413]"
                style={{ backgroundColor: state.tier.badgeColor }}
              >
                LV.{state.tier.level}
              </span>
              <span className="rounded-full border-2 border-[#3A3832] bg-[#141413] px-2.5 py-0.5 text-[11px] font-extrabold text-[#F3C969]">
                {state.totalXp} XP
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-extrabold text-[#F5EFE6] leading-tight">
              {state.tier.title}
            </h3>
            <p className="text-xs text-[#B8B2A6]">{state.tier.subtitle}</p>
            <p className="text-[11px] font-bold text-[#A7D7A9]">
              {state.tier.perkLabel}
            </p>
          </div>
        </div>

        {/* Speech Bubble when petted */}
        {petQuote && (
          <div className="rounded-lg border-2 border-[#F3C969] bg-[#141413] px-3 py-2 text-xs font-semibold text-[#F5EFE6]">
            💬 {petQuote}
          </div>
        )}

        {/* XP Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-[#B8B2A6]">
              {state.nextTier
                ? `Tiến hóa tiếp theo: ${state.nextTier.title}`
                : "Đã đạt cấp tiến hóa tối đa!"}
            </span>
            <span className="text-[#F3C969]">
              {state.nextTier
                ? `${state.xpIntoCurrentTier} / ${state.xpNeededForNextTier} XP`
                : "MAX LEVEL 👑"}
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full border-2 border-[#F5EFE6] bg-[#141413]">
            <div
              className="h-full bg-[#F3C969] transition-all duration-300"
              style={{ width: `${state.progressPct}%` }}
            />
          </div>
        </div>

        {/* 5-Stage Evolution Roadmap Strip */}
        <div className="grid grid-cols-5 gap-1.5 pt-1">
          {CHIBI_TIERS.map((t) => {
            const unlocked = state.totalXp >= t.minXp;
            const isCurrent = t.id === state.tier.id;
            return (
              <div
                key={t.id}
                title={`${t.title} (${t.minXp} XP) — ${t.perkLabel}`}
                className={`flex flex-col items-center justify-center rounded-lg border-2 py-1.5 px-1 text-center ${
                  isCurrent
                    ? "border-[#F5EFE6] bg-[#F3C969] text-[#141413]"
                    : unlocked
                    ? "border-[#A7D7A9] bg-[#141413] text-[#A7D7A9]"
                    : "border-[#3A3832] bg-[#141413] text-[#7A756A]"
                }`}
              >
                <span className="text-[10px] font-black leading-none">
                  LV.{t.level}
                </span>
                <span className="mt-0.5 text-[9px] font-bold truncate max-w-full">
                  {unlocked ? (
                    t.id === "sprout"
                      ? "Mầm"
                      : t.id === "bookworm"
                      ? "Kính"
                      : t.id === "scholar"
                      ? "Mũ"
                      : t.id === "professor"
                      ? "Giáo sư"
                      : "Vua"
                  ) : (
                    <Lock className="h-2.5 w-2.5 mx-auto" />
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT: DAILY QUEST 3/3 PANEL */}
      <div className="lg:col-span-7 flex flex-col justify-between rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-5 shadow-[4px_4px_0_0_#F5EFE6] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border-2 border-[#F5EFE6] bg-[#C8B6FF] px-2.5 py-0.5 text-[10px] font-black uppercase text-[#141413]">
                <Sparkles className="h-3 w-3" />
                Daily Quest
              </span>
              <h3 className="text-sm sm:text-base font-extrabold text-[#F5EFE6]">
                Nhiệm Vụ Học Tập Hôm Nay
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-[#B8B2A6]">
              Hoàn thành đủ 3/3 mục để nhận Rương Thưởng +50 XP giúp Chibi tiến hóa nhanh hơn!
            </p>
          </div>

          <span
            className={`rounded-full border-2 border-[#F5EFE6] px-3 py-1 text-xs font-extrabold shadow-[2px_2px_0_0_#F5EFE6] ${
              state.allQuestsDone
                ? "bg-[#A7D7A9] text-[#141413]"
                : "bg-[#141413] text-[#F3C969]"
            }`}
          >
            {state.completedQuestCount} / 3 Hoàn thành
          </span>
        </div>

        {/* 3 Quest Rows */}
        <div className="space-y-2.5">
          {state.dailyQuests.map((q) => (
            <div
              key={q.id}
              className={`flex items-center justify-between gap-3 rounded-xl border-2 p-3 transition-colors ${
                q.completed
                  ? "border-[#A7D7A9] bg-[#141413]"
                  : "border-[#3A3832] bg-[#141413]"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 ${
                    q.completed
                      ? "border-[#F5EFE6] bg-[#A7D7A9] text-[#141413]"
                      : "border-[#3A3832] bg-[#1D1C19] text-[#B8B2A6]"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xs sm:text-sm font-extrabold ${
                        q.completed
                          ? "text-[#A7D7A9] line-through"
                          : "text-[#F5EFE6]"
                      }`}
                    >
                      {q.title}
                    </span>
                    <span className="rounded-md border border-[#3A3832] bg-[#1D1C19] px-1.5 py-0.5 text-[10px] font-extrabold text-[#F3C969]">
                      +{q.rewardXp} XP
                    </span>
                  </div>
                  <p className="text-[11px] text-[#B8B2A6] truncate">
                    {q.description}
                  </p>
                </div>
              </div>

              {q.completed ? (
                <span className="shrink-0 rounded-full border-2 border-[#141413] bg-[#A7D7A9] px-2.5 py-1 text-[10px] font-black text-[#141413]">
                  ✓ Xong
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleQuestAction(q.id)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-3 py-1.5 text-[11px] font-extrabold text-[#141413] shadow-[2px_2px_0_0_#F5EFE6] transition-transform active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                >
                  <span>{q.actionLabel}</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Daily Bonus Chest Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-[#3A3832] pt-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#B8B2A6]">
            <Gift className="h-4 w-4 text-[#F3C969] shrink-0" />
            <span>
              {state.bonusClaimedToday
                ? "Bạn đã nhận Rương Thưởng +50 XP hôm nay rồi! Hẹn gặp lại ngày mai."
                : state.allQuestsDone
                ? "Tuyệt vời! Bạn đã đủ điều kiện mở Rương Thưởng hôm nay!"
                : `Còn ${3 - state.completedQuestCount} nhiệm vụ nữa để mở Rương Thưởng +50 XP.`}
            </span>
          </div>

          <button
            type="button"
            disabled={!state.allQuestsDone || state.bonusClaimedToday}
            onClick={handleClaimDailyChest}
            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] px-4 py-2 text-xs font-extrabold transition-transform ${
              state.bonusClaimedToday
                ? "bg-[#A7D7A9] text-[#141413] cursor-default"
                : state.allQuestsDone
                ? "bg-[#F3C969] text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] active:translate-x-[2px] active:translate-y-[2px] cursor-pointer"
                : "border-[#3A3832] bg-[#141413] text-[#7A756A] cursor-not-allowed"
            }`}
          >
            <Gift className="h-4 w-4" />
            <span>
              {state.bonusClaimedToday
                ? "✓ Đã nhận +50 XP"
                : "Nhận Rương (+50 XP)"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
