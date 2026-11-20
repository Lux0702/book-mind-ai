"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Mail,
  Sparkles,
  Clock,
  ShieldCheck,
  Inbox,
  Receipt,
  CheckCircle2,
} from "lucide-react";
import { VirtualEmailItem, UserQuotaAccount } from "@/types/course";
import {
  getVirtualEmails,
  markEmailAsRead,
  PLAN_CONFIG,
} from "@/lib/quotaManager";
import { AppUser } from "@/lib/storage";

interface EmailInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser | null;
  quotaAccount: UserQuotaAccount | null;
  onOpenActivateModal: (prefillKey?: string) => void;
}

export default function EmailInboxModal({
  isOpen,
  onClose,
  currentUser,
  onOpenActivateModal,
}: EmailInboxModalProps) {
  const [emails, setEmails] = useState<VirtualEmailItem[]>([]);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const list = getVirtualEmails(currentUser?.email);
      setEmails(list);
      if (list.length > 0) {
        setSelectedEmailId(list[0].id);
        if (!list[0].isRead) {
          markEmailAsRead(list[0].id);
        }
      }
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const selectedEmail =
    emails.find((e) => e.id === selectedEmailId) || emails[0] || null;

  const handleSelectEmail = (item: VirtualEmailItem) => {
    setSelectedEmailId(item.id);
    if (!item.isRead) {
      markEmailAsRead(item.id);
      setEmails((prev) =>
        prev.map((e) => (e.id === item.id ? { ...e, isRead: true } : e))
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141413]/85 p-4">
      <div className="relative flex h-[82vh] max-h-[640px] w-full max-w-4xl flex-col overflow-hidden rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] text-[#F5EFE6] shadow-[6px_6px_0_0_#F5EFE6]">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[#F5EFE6] bg-[#141413] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#F5EFE6] bg-[#B8D8F8] text-[#141413]">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-[#F5EFE6]">
                  Hộp Thư Thông Báo Tài Khoản & Gói Học Tập
                </h2>
                <span className="rounded-full border-2 border-[#F5EFE6] bg-[#A7D7A9] px-2.5 py-0.5 text-[10px] font-extrabold text-[#141413]">
                  {emails.length} thông báo
                </span>
              </div>
              <p className="text-xs text-[#B8B2A6]">
                Tài khoản: <strong className="text-[#F5EFE6]">{currentUser?.email || "local@bookmind.ai"}</strong> — API Key đã được gắn tự động vào dữ liệu tài khoản của bạn
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-2 text-[#F5EFE6] hover:bg-[#FF8A8A] hover:text-[#141413] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Split View */}
        <div className="grid flex-1 grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left: Email List */}
          <div className="md:col-span-4 border-b-2 md:border-b-0 md:border-r-2 border-[#3A3832] bg-[#141413] overflow-y-auto p-3 space-y-2">
            {emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
                <Inbox className="h-10 w-10 text-[#B8B2A6] mb-2" />
                <p className="text-xs font-bold text-[#B8B2A6]">
                  Chưa có thông báo nào trong hộp thư
                </p>
              </div>
            ) : (
              emails.map((item) => {
                const isSelected = selectedEmail?.id === item.id;
                const isUpgrade =
                  item.paymentMethod === "momo" || item.paymentMethod === "vnpay";
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectEmail(item)}
                    className={`w-full text-left rounded-xl p-3.5 border-2 transition-colors cursor-pointer ${
                      isSelected
                        ? "border-[#F5EFE6] bg-[#F3C969] text-[#141413]"
                        : "border-[#3A3832] bg-[#1D1C19] text-[#F5EFE6] hover:border-[#F5EFE6]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`flex items-center gap-1.5 text-[11px] font-extrabold ${isSelected ? "text-[#141413]" : "text-[#B8D8F8]"}`}>
                        {!item.isRead && (
                          <span className="h-2 w-2 rounded-full bg-[#A7D7A9]" />
                        )}
                        BookMind AI
                      </span>
                      <span
                        className={`rounded-md border border-[#141413] px-1.5 py-0.5 text-[10px] font-extrabold text-[#141413] ${
                          item.plan === "unlimited"
                            ? "bg-[#C8B6FF]"
                            : item.plan === "pro"
                            ? "bg-[#F3C969]"
                            : "bg-[#A7D7A9]"
                        }`}
                      >
                        {isUpgrade ? "Biên lai nâng cấp" : "Chào mừng"}
                      </span>
                    </div>
                    <p className="text-xs font-extrabold line-clamp-2 leading-snug">
                      {item.subject}
                    </p>
                    <div className={`mt-2 flex items-center justify-between text-[10px] font-semibold ${isSelected ? "text-[#141413]/80" : "text-[#B8B2A6]"}`}>
                      <span className={isSelected ? "text-[#141413] font-extrabold" : "text-[#A7D7A9]"}>
                        {PLAN_CONFIG[item.plan].name}
                      </span>
                      <span>
                        {new Date(item.createdAt).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right: Email Reader */}
          <div className="md:col-span-8 overflow-y-auto p-6 bg-[#1D1C19]">
            {selectedEmail ? (
              <div className="space-y-5">
                {/* Email Metadata Header */}
                <div className="rounded-xl border-2 border-[#3A3832] bg-[#141413] p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full border-2 border-[#F5EFE6] bg-[#C8B6FF] px-2.5 py-0.5 text-[11px] font-extrabold text-[#141413]">
                      {selectedEmail.paymentMethod === "momo" ||
                      selectedEmail.paymentMethod === "vnpay"
                        ? `Biên lai Thanh toán (${selectedEmail.paymentMethod.toUpperCase()})`
                        : "Thư Xác Nhận Đăng Ký Tài Khoản"}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-[#B8B2A6]">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {new Date(selectedEmail.createdAt).toLocaleString("vi-VN")}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-base font-extrabold text-[#F5EFE6] leading-snug">
                    {selectedEmail.subject}
                  </h3>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t-2 border-[#3A3832] text-xs text-[#B8B2A6]">
                    <div>
                      Từ: <strong className="text-[#F5EFE6]">BookMind AI System</strong>
                    </div>
                    <div>
                      Tới: <strong className="text-[#A7D7A9]">{selectedEmail.toEmail}</strong>
                    </div>
                  </div>
                </div>

                {/* Email Content Body */}
                <div className="rounded-xl border-2 border-[#3A3832] bg-[#141413] p-6 space-y-5">
                  <p className="text-sm text-[#F5EFE6]">
                    Xin chào <strong>{selectedEmail.toName}</strong>,
                  </p>

                  {selectedEmail.paymentMethod === "momo" ||
                  selectedEmail.paymentMethod === "vnpay" ? (
                    <div className="rounded-lg border-2 border-[#A7D7A9] bg-[#1D1C19] p-4 text-xs text-[#F5EFE6] space-y-1.5">
                      <div className="flex items-center gap-2 font-extrabold text-[#A7D7A9] text-sm">
                        <Receipt className="h-4 w-4" />
                        <span>Biên lai nâng cấp gói học tập thành công!</span>
                      </div>
                      <p>
                        • Gói đã kích hoạt:{" "}
                        <strong>{PLAN_CONFIG[selectedEmail.plan].name}</strong>
                      </p>
                      <p>
                        • Cổng thanh toán:{" "}
                        <strong>
                          {selectedEmail.paymentMethod === "momo"
                            ? "Ví điện tử MoMo QR"
                            : "VNPay SmartQR"}
                        </strong>{" "}
                        — Số tiền: <strong>{selectedEmail.amountFormatted}</strong>
                      </p>
                      <p>
                        • Mã giao dịch:{" "}
                        <code className="text-[#F3C969] font-mono font-bold">
                          {selectedEmail.orderCode}
                        </code>
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs sm:text-sm text-[#B8B2A6] leading-relaxed">
                      Chúc mừng bạn đã đăng ký tài khoản học tập trên{" "}
                      <strong className="text-[#F5EFE6]">BookMind AI</strong> thành công! Hệ thống đã tự động cấp phát và gắn{" "}
                      <strong className="text-[#B8D8F8]">
                        API Key gián tiếp bảo mật
                      </strong>{" "}
                      trực tiếp vào dữ liệu tài khoản của bạn mà không cần phải nhập tay.
                    </p>
                  )}

                  {/* Highlighted Status Box */}
                  <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-5 text-center space-y-3 shadow-[3px_3px_0_0_#F5EFE6]">
                    <div className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#F5EFE6] bg-[#A7D7A9] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#141413]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>
                        Đã Tự Động Kích Hoạt • {PLAN_CONFIG[selectedEmail.plan].name}
                      </span>
                    </div>

                    <div className="text-base sm:text-lg font-extrabold text-[#F5EFE6]">
                      Hạn mức của bạn:{" "}
                      <span className="text-[#F3C969]">
                        {selectedEmail.maxCalls === -1
                          ? "Không giới hạn lượt gọi AI (Unlimited)"
                          : `${selectedEmail.maxCalls} lượt gọi AI / ngày (Tự động reset mỗi ngày)`}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={onClose}
                        className="flex items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-5 py-2.5 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
                      >
                        <Sparkles className="h-4 w-4" />
                        <span>Bắt đầu học ngay</span>
                      </button>

                      {selectedEmail.plan === "free" && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenActivateModal();
                          }}
                          className="flex items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#C8B6FF] px-4 py-2.5 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
                        >
                          <span>Xem Gói Pro (50 lượt/ngày) & Unlimited</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border-2 border-[#3A3832] bg-[#1D1C19] p-4 text-xs text-[#B8B2A6] flex items-center gap-2.5">
                    <ShieldCheck className="h-4 w-4 text-[#A7D7A9] shrink-0" />
                    <span>
                      Mã API Key nội bộ của bạn được lưu trữ an toàn trong hồ sơ người dùng và tự động làm mới hạn mức vào 00:00 mỗi ngày.
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
