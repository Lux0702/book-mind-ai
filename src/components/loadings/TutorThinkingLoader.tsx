"use client";

import React from "react";
import { Sparkles, Bot } from "lucide-react";

export default function TutorThinkingLoader() {
  return (
    <div className="mt-4 rounded-xl border-2 border-[#F5EFE6] bg-[#141413] p-4 shadow-[3px_3px_0_0_#F5EFE6]">
      <div className="flex items-center gap-3">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-[#F5EFE6] bg-[#C8B6FF] text-[#141413]">
          <Bot className="h-4 w-4" />
          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-[#A7D7A9] border border-[#141413] animate-ping" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-[#C8B6FF]">
              Gia sư AI BookMind
            </span>
            <span className="text-[10px] font-semibold text-[#B8B2A6]">
              đang suy nghĩ câu trả lời...
            </span>
          </div>

          {/* Thinking Sound Wave / Pulse Dots */}
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#F3C969] animate-[bounce_1s_infinite_100ms]" />
            <span className="h-2 w-2 rounded-full bg-[#C8B6FF] animate-[bounce_1s_infinite_300ms]" />
            <span className="h-2 w-2 rounded-full bg-[#A7D7A9] animate-[bounce_1s_infinite_500ms]" />
            <span className="ml-2 text-[11px] italic text-[#B8B2A6]">
              Đối chiếu văn bản chương sách & kiến thức ngữ cảnh...
            </span>
          </div>
        </div>
      </div>

      {/* Skeleton lines */}
      <div className="mt-3.5 space-y-2 pt-2.5 border-t-2 border-[#3A3832]">
        <div className="h-2.5 rounded-full bg-[#3A3832] animate-pulse w-5/6" />
        <div className="h-2.5 rounded-full bg-[#3A3832] animate-pulse w-full" />
        <div className="h-2.5 rounded-full bg-[#3A3832] animate-pulse w-2/3" />
      </div>
    </div>
  );
}

