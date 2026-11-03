"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string | number;
  label: string;
  subLabel?: string;
  badge?: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  value: string | number;
  onChange: (value: string) => void;
  options: SelectOption[];
  icon?: React.ReactNode;
  placeholder?: string;
  accentColor?: "indigo" | "emerald" | "amber" | "purple";
  size?: "sm" | "md";
  className?: string;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  icon,
  placeholder = "Chọn một mục...",
  accentColor = "indigo",
  size = "md",
  className = "",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption =
    options.find((opt) => String(opt.value) === String(value)) || options[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const accentStyles = {
    indigo: {
      activeBorder: "border-indigo-500/60 ring-2 ring-indigo-500/20",
      hoverBorder: "hover:border-indigo-500/40",
      iconBg: "bg-indigo-500/15 text-indigo-400 border-indigo-500/25",
      selectedItem:
        "bg-indigo-500/15 border-indigo-500/30 text-white font-semibold",
      checkText: "text-indigo-400",
      badgeBg: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    },
    emerald: {
      activeBorder: "border-emerald-500/60 ring-2 ring-emerald-500/20",
      hoverBorder: "hover:border-emerald-500/40",
      iconBg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
      selectedItem:
        "bg-emerald-500/15 border-emerald-500/30 text-white font-semibold",
      checkText: "text-emerald-400",
      badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    },
    amber: {
      activeBorder: "border-amber-500/60 ring-2 ring-amber-500/20",
      hoverBorder: "hover:border-amber-500/40",
      iconBg: "bg-amber-500/15 text-amber-400 border-amber-500/25",
      selectedItem:
        "bg-amber-500/15 border-amber-500/30 text-white font-semibold",
      checkText: "text-amber-400",
      badgeBg: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    },
    purple: {
      activeBorder: "border-purple-500/60 ring-2 ring-purple-500/20",
      hoverBorder: "hover:border-purple-500/40",
      iconBg: "bg-purple-500/15 text-purple-400 border-purple-500/25",
      selectedItem:
        "bg-purple-500/15 border-purple-500/30 text-white font-semibold",
      checkText: "text-purple-400",
      badgeBg: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    },
  }[accentColor];

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group flex w-full items-center justify-between gap-2.5 rounded-xl border bg-slate-950/90 text-left transition-all duration-150 cursor-pointer ${
          size === "sm" ? "px-3 py-1.5 text-xs" : "px-3.5 py-2.5 text-xs"
        } ${
          isOpen
            ? accentStyles.activeBorder
            : `border-slate-800 ${accentStyles.hoverBorder} hover:bg-slate-900/90`
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {(selectedOption?.icon || icon) && (
            <span
              className={`flex shrink-0 items-center justify-center rounded-lg border leading-none ${
                size === "sm"
                  ? "h-6 w-6"
                  : selectedOption?.subLabel
                  ? "h-8 w-8"
                  : "h-7 w-7"
              } ${accentStyles.iconBg}`}
            >
              {selectedOption?.icon || icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-slate-100 group-hover:text-white">
              {selectedOption ? selectedOption.label : placeholder}
            </div>
            {selectedOption?.subLabel && (
              <div className="truncate text-[10px] text-slate-400">
                {selectedOption.subLabel}
              </div>
            )}
          </div>
          {selectedOption?.badge && (
            <span
              className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${accentStyles.badgeBg}`}
            >
              {selectedOption.badge}
            </span>
          )}
        </div>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:text-slate-200 ${
            isOpen ? "rotate-180 text-white" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-2 min-w-[220px] origin-top overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 p-1.5 shadow-2xl shadow-black/80 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          <div className="max-h-64 space-y-1 overflow-y-auto pr-0.5">
            {options.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => {
                    onChange(String(opt.value));
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2.5 rounded-xl border px-3 py-2 text-left text-xs transition cursor-pointer ${
                    isSelected
                      ? accentStyles.selectedItem
                      : "border-transparent text-slate-300 hover:bg-slate-800/80 hover:text-white"
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    {(opt.icon || icon) && (
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${
                          isSelected
                            ? accentStyles.iconBg
                            : "border-slate-800 bg-slate-950 text-slate-400"
                        }`}
                      >
                        {opt.icon || icon}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{opt.label}</div>
                      {opt.subLabel && (
                        <div className="truncate text-[10px] text-slate-400 font-normal">
                          {opt.subLabel}
                        </div>
                      )}
                    </div>
                    {opt.badge && (
                      <span
                        className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${
                          isSelected
                            ? accentStyles.badgeBg
                            : "border-slate-700 bg-slate-800 text-slate-400"
                        }`}
                      >
                        {opt.badge}
                      </span>
                    )}
                  </div>

                  {isSelected && (
                    <Check
                      className={`h-4 w-4 shrink-0 ${accentStyles.checkText}`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

