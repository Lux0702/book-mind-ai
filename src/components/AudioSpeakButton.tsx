"use client";

import React, { useState, useEffect } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { speakSmart } from "@/lib/tts";

interface AudioSpeakButtonProps {
  text: string;
  label?: string;
  showLabel?: boolean;
  className?: string;
  size?: "sm" | "md";
}

export default function AudioSpeakButton({
  text,
  label = "Nghe",
  showLabel = true,
  className = "",
  size = "sm",
}: AudioSpeakButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const handleStatus = (e: Event) => {
      const customEvent = e as CustomEvent<{ isPlaying: boolean; text: string }>;
      if (customEvent.detail) {
        if (!customEvent.detail.isPlaying) {
          setIsPlaying(false);
        } else {
          // Compare cleaned text
          const targetCleaned = text.replace(/[_*#]/g, " ").trim();
          setIsPlaying(customEvent.detail.text === targetCleaned);
        }
      }
    };

    window.addEventListener("bookmind-tts-status", handleStatus);
    return () => window.removeEventListener("bookmind-tts-status", handleStatus);
  }, [text]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    speakSmart(text, e);
  };

  const isSmall = size === "sm";

  return (
    <button
      type="button"
      onClick={handleClick}
      title={isPlaying ? "Đang đọc... Bấm để đọc lại từ đầu" : "Bấm để nghe phát âm"}
      className={`inline-flex items-center gap-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
        isPlaying
          ? "bg-indigo-500/25 text-indigo-300 ring-1 ring-indigo-400/50 shadow-sm shadow-indigo-500/20 px-2 py-0.5"
          : "text-slate-400 hover:text-indigo-300 hover:bg-slate-800/60 px-1.5 py-0.5"
      } ${className}`}
    >
      {isPlaying ? (
        <span className="flex items-center gap-0.5">
          <Volume2 className={`${isSmall ? "h-3.5 w-3.5" : "h-4 w-4"} text-indigo-400 animate-pulse`} />
          <span className="flex items-end gap-0.5 h-3 ml-0.5">
            <span className="w-0.5 h-1.5 bg-indigo-400 rounded-full animate-[bounce_0.8s_infinite_100ms]" />
            <span className="w-0.5 h-3 bg-indigo-300 rounded-full animate-[bounce_0.8s_infinite_300ms]" />
            <span className="w-0.5 h-2 bg-indigo-400 rounded-full animate-[bounce_0.8s_infinite_200ms]" />
          </span>
        </span>
      ) : (
        <Volume2 className={`${isSmall ? "h-3.5 w-3.5" : "h-4 w-4"} transition-transform hover:scale-110`} />
      )}
      {showLabel && (
        <span className={`${isSmall ? "text-xs" : "text-sm"} font-medium`}>
          {isPlaying ? "Đang đọc" : label}
        </span>
      )}
    </button>
  );
}

