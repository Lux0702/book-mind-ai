import type { Metadata } from "next";
import "./globals.css";
import GlobalFeedbackOverlay from "@/components/ui/GlobalFeedbackOverlay";

export const metadata: Metadata = {
  title: "BookMind AI — Gia Sư Đọc Sách & Tạo Lộ Trình Học Ngoại Ngữ",
  description:
    "Biến mọi cuốn sách PDF (kể cả 80MB+) thành một Khóa học (Course) riêng biệt với Diễn giải chuyên sâu, Ngữ pháp, Flashcard SRS, Điền từ, Trắc nghiệm và AI Chấm điểm dịch câu.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="dark" suppressHydrationWarning>
      <body
        className="min-h-screen bg-slate-950 text-slate-100"
        suppressHydrationWarning
      >
        <GlobalFeedbackOverlay />
        {children}
      </body>
    </html>
  );
}
