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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative flex h-[82vh] max-h-[640px] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-white">
                  Hộp Thư Thông Báo Tài Khoản & Gói Học Tập
                </h2>
                <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                  {emails.length} thông báo
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Tài khoản: <strong className="text-slate-200">{currentUser?.email || "local@bookmind.ai"}</strong> — API Key đã được gắn tự động vào dữ liệu tài khoản của bạn
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Split View */}
        <div className="grid flex-1 grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left: Email List */}
          <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/40 overflow-y-auto p-3 space-y-2">
            {emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
                <Inbox className="h-10 w-10 text-slate-600 mb-2" />
                <p className="text-xs font-semibold text-slate-400">
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
                    className={`w-full text-left rounded-2xl p-3.5 border transition cursor-pointer ${
                      isSelected
                        ? "border-indigo-500/50 bg-indigo-950/30 shadow-md"
                        : "border-slate-800/70 bg-slate-900/60 hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-300">
                        {!item.isRead && (
                          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        )}
                        BookMind AI
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                          item.plan === "unlimited"
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : item.plan === "pro"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        }`}
                      >
                        {isUpgrade ? "Biên lai nâng cấp" : "Chào mừng"}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-white line-clamp-2 leading-snug">
                      {item.subject}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                      <span className="text-emerald-400 font-semibold">
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
          <div className="md:col-span-8 overflow-y-auto p-6 bg-slate-900/50">
            {selectedEmail ? (
              <div className="space-y-5">
                {/* Email Metadata Header */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-lg bg-indigo-500/15 border border-indigo-500/30 px-2.5 py-1 text-[11px] font-bold text-indigo-300">
                      {selectedEmail.paymentMethod === "momo" ||
                      selectedEmail.paymentMethod === "vnpay"
                        ? `Biên lai Thanh toán (${selectedEmail.paymentMethod.toUpperCase()})`
                        : "Thư Xác Nhận Đăng Ký Tài Khoản"}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {new Date(selectedEmail.createdAt).toLocaleString("vi-VN")}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-base font-extrabold text-white leading-snug">
                    {selectedEmail.subject}
                  </h3>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-xs text-slate-400">
                    <div>
                      Từ: <strong className="text-slate-200">BookMind AI System</strong>
                    </div>
                    <div>
                      Tới: <strong className="text-emerald-300">{selectedEmail.toEmail}</strong>
                    </div>
                  </div>
                </div>

                {/* Email Content Body */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-6 space-y-5 shadow-inner">
                  <p className="text-sm text-slate-200">
                    Xin chào <strong>{selectedEmail.toName}</strong>,
                  </p>

                  {selectedEmail.paymentMethod === "momo" ||
                  selectedEmail.paymentMethod === "vnpay" ? (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-xs text-emerald-200 space-y-1.5">
                      <div className="flex items-center gap-2 font-bold text-emerald-300 text-sm">
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
                        <code className="text-amber-300 font-mono">
                          {selectedEmail.orderCode}
                        </code>
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      Chúc mừng bạn đã đăng ký tài khoản học tập trên{" "}
                      <strong className="text-white">BookMind AI</strong> thành công! Hệ thống đã tự động cấp phát và gắn{" "}
                      <strong className="text-indigo-300">
                        API Key gián tiếp bảo mật
                      </strong>{" "}
                      trực tiếp vào dữ liệu tài khoản của bạn mà không cần phải nhập tay.
                    </p>
                  )}

                  {/* Highlighted Status Box */}
                  <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/30 to-slate-950 p-5 text-center space-y-3">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>
                        Đã Tự Động Kích Hoạt • {PLAN_CONFIG[selectedEmail.plan].name}
                      </span>
                    </div>

                    <div className="text-base sm:text-lg font-extrabold text-white">
                      Hạn mức của bạn:{" "}
                      <span className="text-amber-300">
                        {selectedEmail.maxCalls === -1
                          ? "Không giới hạn lượt gọi AI (Unlimited)"
                          : `${selectedEmail.maxCalls} lượt gọi AI / ngày (Tự động reset mỗi ngày)`}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={onClose}
                        className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition cursor-pointer"
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
                          className="flex items-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-500/15 hover:bg-indigo-500/25 px-4 py-2.5 text-xs font-bold text-indigo-300 transition cursor-pointer"
                        >
                          <span>Xem Gói Pro (50 lượt/ngày) & Unlimited</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-4 text-xs text-slate-400 flex items-center gap-2.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
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
