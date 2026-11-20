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
      activeBorder: "border-[#F3C969] shadow-[2px_2px_0_0_#F3C969]",
      hoverBorder: "hover:border-[#F3C969]",
      iconBg: "bg-[#B8D8F8] text-[#141413] border-[#141413]",
      selectedItem:
        "bg-[#F3C969] border-[#F5EFE6] text-[#141413] font-extrabold",
      checkText: "text-[#141413]",
      badgeBg: "bg-[#B8D8F8] text-[#141413] border-[#141413]",
    },
    emerald: {
      activeBorder: "border-[#A7D7A9] shadow-[2px_2px_0_0_#A7D7A9]",
      hoverBorder: "hover:border-[#A7D7A9]",
      iconBg: "bg-[#A7D7A9] text-[#141413] border-[#141413]",
      selectedItem:
        "bg-[#A7D7A9] border-[#F5EFE6] text-[#141413] font-extrabold",
      checkText: "text-[#141413]",
      badgeBg: "bg-[#A7D7A9] text-[#141413] border-[#141413]",
    },
    amber: {
      activeBorder: "border-[#F3C969] shadow-[2px_2px_0_0_#F3C969]",
      hoverBorder: "hover:border-[#F3C969]",
      iconBg: "bg-[#F3C969] text-[#141413] border-[#141413]",
      selectedItem:
        "bg-[#F3C969] border-[#F5EFE6] text-[#141413] font-extrabold",
      checkText: "text-[#141413]",
      badgeBg: "bg-[#F3C969] text-[#141413] border-[#141413]",
    },
    purple: {
      activeBorder: "border-[#C8B6FF] shadow-[2px_2px_0_0_#C8B6FF]",
      hoverBorder: "hover:border-[#C8B6FF]",
      iconBg: "bg-[#C8B6FF] text-[#141413] border-[#141413]",
      selectedItem:
        "bg-[#C8B6FF] border-[#F5EFE6] text-[#141413] font-extrabold",
      checkText: "text-[#141413]",
      badgeBg: "bg-[#C8B6FF] text-[#141413] border-[#141413]",
    },
  }[accentColor];

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group flex w-full items-center justify-between gap-2.5 rounded-lg border-2 bg-[#141413] text-left transition-colors cursor-pointer ${
          size === "sm" ? "px-3 py-1.5 text-xs" : "min-h-[54px] px-3.5 py-2 text-xs"
        } ${
          isOpen
            ? accentStyles.activeBorder
            : `border-[#F5EFE6] ${accentStyles.hoverBorder}`
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {(selectedOption?.icon || icon) && (
            <span
              className={`flex shrink-0 items-center justify-center rounded-md border leading-none ${
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
            <div className="truncate font-bold text-[#F5EFE6]">
              {selectedOption ? selectedOption.label : placeholder}
            </div>
            {selectedOption?.subLabel && (
              <div className="truncate text-[10px] text-[#B8B2A6]">
                {selectedOption.subLabel}
              </div>
            )}
          </div>
          {selectedOption?.badge && (
            <span
              className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold ${accentStyles.badgeBg}`}
            >
              {selectedOption.badge}
            </span>
          )}
        </div>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#F5EFE6] transition-transform duration-150 ${
            isOpen ? "rotate-180 text-[#F3C969]" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-2 min-w-[220px] origin-top overflow-hidden rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-1.5 shadow-[4px_4px_0_0_#F5EFE6]">
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
                  className={`flex w-full items-center justify-between gap-2.5 rounded-lg border-2 px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? accentStyles.selectedItem
                      : "border-transparent text-[#F5EFE6] hover:border-[#3A3832] hover:bg-[#141413]"
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    {(opt.icon || icon) && (
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                          isSelected
                            ? accentStyles.iconBg
                            : "border-[#3A3832] bg-[#141413] text-[#B8B2A6]"
                        }`}
                      >
                        {opt.icon || icon}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold">{opt.label}</div>
                      {opt.subLabel && (
                        <div
                          className={`truncate text-[10px] font-medium ${
                            isSelected ? "text-[#141413]/80" : "text-[#B8B2A6]"
                          }`}
                        >
                          {opt.subLabel}
                        </div>
                      )}
                    </div>
                    {opt.badge && (
                      <span
                        className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold ${
                          isSelected
                            ? accentStyles.badgeBg
                            : "border-[#3A3832] bg-[#141413] text-[#B8B2A6]"
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

