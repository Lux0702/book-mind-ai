"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Download,
  Upload,
  Check,
  ShieldCheck,
  Sparkles,
  Sliders,
  Database,
  ExternalLink,
} from "lucide-react";
import { AppSettings } from "@/types/course";
import CustomSelect from "./ui/CustomSelect";
import {
  DEFAULT_SETTINGS,
  getAppSettings,
  saveAppSettings,
  exportAllDataJSON,
  importAllDataJSON,
} from "@/lib/storage";
import { runWithFeedback, showToast } from "@/lib/feedback";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChanged: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  onSettingsChanged,
}: SettingsModalProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [savedNotice, setSavedNotice] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSettings(getAppSettings());
      setSavedNotice(false);
      setImportStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    await runWithFeedback(
      {
        variant: "edit",
        loadingTitle: "Đang lưu cấu hình học tập...",
        successTitle: "Đã lưu cài đặt thành công!",
      },
      async () => {
        saveAppSettings(settings);
        setSavedNotice(true);
        onSettingsChanged();
      }
    );
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 600);
  };

  const handleExport = async () => {
    await runWithFeedback(
      {
        variant: "sync",
        loadingTitle: "Đang đóng gói dữ liệu sao lưu JSON...",
        successTitle: "Đã tải xuống bản sao lưu JSON!",
      },
      async () => {
        const json = await exportAllDataJSON();
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `book-learning-courses-backup-${new Date()
          .toISOString()
          .slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    );
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const count = await runWithFeedback(
        {
          variant: "sync",
          loadingTitle: "Đang khôi phục dữ liệu từ bản sao lưu...",
          loadingSubtitle: "Đồng bộ khóa học & thẻ Flashcard vào bộ nhớ",
        },
        async () => {
          const text = await file.text();
          return await importAllDataJSON(text);
        }
      );
      setImportStatus(`Đã khôi phục thành công ${count} khóa học!`);
      showToast({
        type: "success",
        title: `Đã khôi phục ${count} khóa học!`,
        durationMs: 1800,
      });
      setTimeout(() => setImportStatus(null), 1800);
      onSettingsChanged();
    } catch {
      setImportStatus("Lỗi định dạng file JSON sao lưu.");
      setTimeout(() => setImportStatus(null), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141413]/85 p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] text-[#F5EFE6] shadow-[6px_6px_0_0_#F5EFE6]">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[#F5EFE6] bg-[#141413] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#F5EFE6] bg-[#C8B6FF] text-[#141413]">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#F5EFE6]">
                Tùy chỉnh Học tập & Sao lưu Dữ liệu
              </h2>
              <p className="text-xs text-[#B8B2A6]">
                Chọn mô hình AI phản hồi và sao lưu các khóa học cá nhân của bạn
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-1.5 text-[#F5EFE6] hover:bg-[#FF8A8A] hover:text-[#141413] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {/* Section 1: AI Model Preference */}
          <div className="space-y-3 rounded-xl border-2 border-[#3A3832] bg-[#141413] p-4">
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#C8B6FF]">
              <Sparkles className="h-4 w-4" />
              1. Mô hình AI Ưu tiên
            </h3>

            <div className="rounded-lg border-2 border-[#A7D7A9] bg-[#1D1C19] p-3 text-xs text-[#F5EFE6] flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-[#A7D7A9] shrink-0" />
              <span>
                Tài khoản của bạn đã được hệ thống tự động cấp phát và liên kết quyền gọi AI. Hạn mức lượt gọi tự động làm mới vào 00:00 mỗi ngày.
              </span>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#B8B2A6]">
                Chọn mô hình xử lý bài học & chấm điểm
              </label>
              <CustomSelect
                value={settings.geminiModel}
                onChange={(newVal) =>
                  setSettings({ ...settings, geminiModel: newVal })
                }
                size="md"
                accentColor="indigo"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                options={[
                  {
                    value: "gemini-2.5-flash",
                    label: "Google Gemini 2.5 Flash (+ Tự động chuyển sang Qwen khi hết Quota)",
                    subLabel: "Ưu tiên Gemini, tự động nhảy sang Qwen (Groq/SiliconFlow/OpenRouter) nếu hết 20 lượt",
                    badge: "Auto 4 Tầng",
                  },
                  {
                    value: "qwen-groq",
                    label: "⚡ Qwen 3 32B — Groq Cloud Siêu Tốc (Free)",
                    subLabel: "Tốc độ tạo bài 2–3 giây, hạn mức 1.000+ lượt/ngày miễn phí",
                    badge: "Siêu tốc Free",
                  },
                  {
                    value: "qwen-openrouter",
                    label: "🟢 Qwen 2.5 72B & Qwen VL Vision — OpenRouter (Free)",
                    subLabel: "Bản 72B thông minh nhất + đọc trực tiếp ảnh trang sách (:free $0.00)",
                    badge: "Qwen 72B Free",
                  },
                  {
                    value: "qwen-siliconflow",
                    label: "🔵 Qwen 2.5 7B & VL — SiliconFlow Cloud (Free)",
                    subLabel: "Chính chủ hệ sinh thái Qwen, cực chuẩn tiếng Trung/Anh miễn phí",
                    badge: "Qwen Cloud",
                  },
                  {
                    value: "gemini-2.0-flash",
                    label: "Google Gemini 2.0 Flash",
                    subLabel: "Phản hồi nhanh cho dịch câu và phát âm",
                    badge: "Tốc độ cao",
                  },
                  {
                    value: "gemini-2.5-pro",
                    label: "Google Gemini 2.5 Pro",
                    subLabel: "Phân tích ngữ pháp & diễn giải sách chuyên sâu nhất",
                    badge: "Chuyên sâu",
                  },
                ]}
              />
            </div>
          </div>

          {/* Section 2: JSON Backup & Restore */}
          <div className="space-y-3 rounded-xl border-2 border-[#3A3832] bg-[#141413] p-4">
            <h3 className="text-sm font-extrabold text-[#F3C969]">
              2. Sao lưu & Khôi phục toàn bộ Khóa học (File .JSON)
            </h3>
            <p className="text-xs text-[#B8B2A6]">
              Xuất toàn bộ các Course, bài học AI đã tạo và tiến độ Flashcard ra file để cất giữ hoặc chuyển sang thiết bị khác bất kỳ lúc nào.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleExport}
                className="flex items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-4 py-2 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
              >
                <Download className="h-4 w-4 text-[#141413]" />
                Xuất file Backup (.JSON)
              </button>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#B8D8F8] px-4 py-2 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6]">
                <Upload className="h-4 w-4 text-[#141413]" />
                Khôi phục từ file (.JSON)
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>
              {importStatus && (
                <span className="text-xs font-extrabold text-[#A7D7A9]">
                  {importStatus}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t-2 border-[#3A3832] bg-[#141413] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] px-4 py-2 text-sm font-bold text-[#F5EFE6] shadow-[2px_2px_0_0_#F5EFE6] transition-transform active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-5 py-2 text-sm font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
          >
            {savedNotice ? (
              <>
                <Check className="h-4 w-4" />
                Đã lưu!
              </>
            ) : (
              "Lưu tùy chỉnh"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
