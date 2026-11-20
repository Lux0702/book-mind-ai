"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Volume2, Sparkles, X, Loader2 } from "lucide-react";
import { fetchAiAgent } from "@/lib/quotaManager";
import { getAppSettings } from "@/lib/storage";
import { speakSmart, stopAllSpeech } from "@/lib/tts";

interface SelectionAiPopoverProps {
  containerRef?: React.RefObject<HTMLElement | null>;
  courseTitle: string;
  chapterTitle: string;
  chapterText: string;
  selectedAiModel: string;
}

interface AnchorCoords {
  left: number;
  top?: number;
  bottom?: number;
}

function isNodeRestricted(
  node: Node | null,
  popoverEl: HTMLDivElement | null
): boolean {
  if (!node) return false;
  const el = node instanceof Element ? node : node.parentElement;
  if (!el) return false;
  if (popoverEl && popoverEl.contains(el)) return true;
  if (el.closest("input, textarea, select, [contenteditable]")) return true;
  return false;
}

function computePopoverAnchor(sel: Selection): AnchorCoords | null {
  if (!sel || sel.rangeCount === 0) return null;
  try {
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const halfW = Math.min(230, (vw - 24) / 2);
    const rawCenter = rect.left + rect.width / 2;
    const clampedLeft = Math.max(
      halfW + 12,
      Math.min(vw - halfW - 12, rawCenter)
    );

    // Prefer placing above the highlighted text when there is comfortable room;
    // otherwise place just below the selection so AI answers stay inside viewport.
    if (rect.top > 280) {
      return {
        left: clampedLeft,
        bottom: Math.max(12, vh - rect.top + 10),
      };
    }
    return {
      left: clampedLeft,
      top: Math.max(12, Math.min(vh - 180, rect.bottom + 10)),
    };
  } catch {
    return null;
  }
}

export default function SelectionAiPopover({
  courseTitle,
  chapterTitle,
  chapterText,
  selectedAiModel,
}: SelectionAiPopoverProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [anchorCoords, setAnchorCoords] = useState<AnchorCoords | null>(null);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);

  const popoverRef = useRef<HTMLDivElement | null>(null);
  const selectedTextRef = useRef(selectedText);
  const aiAnswerRef = useRef(aiAnswer);
  const isExplainingRef = useRef(isExplaining);
  const manualTriggerUntilRef = useRef(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    selectedTextRef.current = selectedText;
  }, [selectedText]);

  useEffect(() => {
    aiAnswerRef.current = aiAnswer;
  }, [aiAnswer]);

  useEffect(() => {
    isExplainingRef.current = isExplaining;
  }, [isExplaining]);

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const evaluateSelection = (eventTarget?: EventTarget | null) => {
      if (
        eventTarget instanceof Node &&
        popoverRef.current?.contains(eventTarget)
      ) {
        return;
      }

      const sel = window.getSelection();
      const rawText = sel ? sel.toString().replace(/\s+/g, " ").trim() : "";

      if (!sel || sel.isCollapsed || !rawText) {
        if (Date.now() < manualTriggerUntilRef.current) return;
        if (!aiAnswerRef.current && !isExplainingRef.current && selectedTextRef.current) {
          setSelectedText("");
          setAnchorCoords(null);
        }
        return;
      }

      if (
        isNodeRestricted(sel.anchorNode, popoverRef.current) ||
        isNodeRestricted(sel.focusNode, popoverRef.current)
      ) {
        return;
      }

      if (rawText.length >= 2 && rawText.length <= 800) {
        const coords = computePopoverAnchor(sel);
        setAnchorCoords(coords);
        if (selectedTextRef.current !== rawText) {
          setSelectedText(rawText);
          setAiAnswer(null);
          setAiError(null);
        }
      }
    };

    const scheduleEvaluate = (eventTarget: EventTarget | null, delayMs: number) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        evaluateSelection(eventTarget);
      }, delayMs);
    };

    const handleMouseUp = (e: MouseEvent) => {
      scheduleEvaluate(e.target, 15);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      scheduleEvaluate(e.target, 120);
    };

    const handleSelectionChange = () => {
      scheduleEvaluate(null, 120);
    };

    const handleScroll = () => {
      if (!selectedTextRef.current) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim().length >= 2) {
        const coords = computePopoverAnchor(sel);
        if (coords) setAnchorCoords(coords);
      }
    };

    const handleSampleSelection = (e: Event) => {
      const sampleText = (e as CustomEvent<{ text?: string }>).detail?.text
        ?.replace(/\s+/g, " ")
        .trim();
      if (!sampleText || sampleText.length < 2) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      manualTriggerUntilRef.current = Date.now() + 600;
      setAnchorCoords(null);
      setSelectedText(sampleText.slice(0, 800));
      setAiAnswer(null);
      setAiError(null);
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    document.addEventListener("selectionchange", handleSelectionChange);
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("bookmind:sample-selection", handleSampleSelection);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("selectionchange", handleSelectionChange);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener(
        "bookmind:sample-selection",
        handleSampleSelection
      );
    };
  }, []);

  const handleClose = () => {
    manualTriggerUntilRef.current = 0;
    setSelectedText("");
    setAnchorCoords(null);
    setAiAnswer(null);
    setAiError(null);
    stopAllSpeech();
    try {
      window.getSelection()?.removeAllRanges();
    } catch {
      // Ignore selection clear error
    }
  };

  const handleExplainSelection = async () => {
    if (!selectedText || isExplaining) return;
    setIsExplaining(true);
    setAiError(null);
    setAiAnswer(null);

    try {
      const settings = getAppSettings();
      const res = await fetchAiAgent("/api/agent/ask-tutor", {
        courseTitle,
        chapterTitle,
        chapterText: chapterText.slice(0, 6000),
        selectedExcerpt: selectedText,
        question:
          "Hãy giải thích ngắn gọn (3–4 dòng tiếng Việt thật dễ hiểu): từ/cụm từ/câu tiếng Anh tôi vừa bôi đen có nghĩa là gì trong ngữ cảnh chương này, từ loại/phiên âm hoặc cấu trúc đáng chú ý (nếu có), và 1 ví dụ ngắn.",
        apiKey: settings.geminiApiKey,
        masterApiKey: settings.masterGeminiApiKey,
        model: selectedAiModel || settings.geminiModel,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Không thể giải thích đoạn bôi đen.");
      }
      setAiAnswer(String(data.answer || "").trim());
    } catch (err: unknown) {
      setAiError(
        err instanceof Error ? err.message : "Đã xảy ra lỗi khi hỏi AI."
      );
    } finally {
      setIsExplaining(false);
    }
  };

  if (!mounted || !selectedText) return null;

  const positionStyle: React.CSSProperties | undefined = anchorCoords
    ? {
        left: `${anchorCoords.left}px`,
        transform: "translateX(-50%)",
        ...(anchorCoords.top !== undefined ? { top: `${anchorCoords.top}px` } : {}),
        ...(anchorCoords.bottom !== undefined
          ? { bottom: `${anchorCoords.bottom}px` }
          : {}),
      }
    : undefined;

  return createPortal(
    <div
      ref={popoverRef}
      onMouseDown={(e) => e.preventDefault()}
      onTouchStart={(e) => e.stopPropagation()}
      style={positionStyle}
      className={
        anchorCoords
          ? "fixed z-[85] w-[min(460px,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)]"
          : "fixed bottom-[4.75rem] lg:bottom-6 left-1/2 -translate-x-1/2 z-[85] w-[min(460px,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)]"
      }
    >
      <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-3 sm:p-3.5 shadow-[4px_4px_0_0_#F5EFE6] animate-in fade-in zoom-in-95 duration-150">
        {/* Top bar: selected text + actions */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#F3C969]">
              Văn bản vừa chọn
            </span>
            <p className="truncate font-serif text-xs sm:text-sm font-bold text-[#F5EFE6]">
              &ldquo;{selectedText}&rdquo;
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => speakSmart(selectedText)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#B8D8F8] px-3 py-1.5 text-xs font-bold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
              title="Nghe phát âm chuẩn đoạn vừa chọn"
            >
              <Volume2 className="h-3.5 w-3.5" />
              <span>Nghe</span>
            </button>

            <button
              type="button"
              disabled={isExplaining}
              onClick={handleExplainSelection}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-3.5 py-1.5 text-xs font-bold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform disabled:opacity-50 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
            >
              {isExplaining ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span>AI Giải thích</span>
            </button>

            <button
              type="button"
              onClick={handleClose}
              aria-label="Đóng thanh giải thích nhanh"
              className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-xl border-2 border-[#F5EFE6] bg-[#141413] text-[#F5EFE6] shadow-[3px_3px_0_0_#F5EFE6] transition-transform hover:bg-[#262520] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* AI Explanation Result */}
        {aiAnswer && (
          <div className="mt-2.5 max-h-56 overflow-y-auto rounded-lg border-2 border-[#3A3832] bg-[#141413] p-3 text-xs sm:text-sm leading-relaxed text-[#F5EFE6] whitespace-pre-wrap animate-in fade-in duration-200">
            {aiAnswer}
          </div>
        )}

        {aiError && (
          <div className="mt-2 rounded-lg border-2 border-[#FF8A8A] bg-[#261919] px-3 py-2 text-xs font-semibold text-[#FF8A8A]">
            {aiError}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
