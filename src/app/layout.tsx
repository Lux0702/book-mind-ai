import type { Metadata } from "next";
import "./globals.css";
import GlobalFeedbackOverlay from "@/components/ui/GlobalFeedbackOverlay";

export const metadata: Metadata = {
  title: "BookMind AI — Gia Sư Đọc Sách & Học Từ Vựng Đa Ngôn Ngữ",
  description:
    "Biến mọi cuốn sách PDF (kể cả 80MB+) thành một Khóa học (Course) riêng biệt với Diễn giải chuyên sâu, Ngữ pháp, Flashcard SRS, Từ vựng Chủ đề, Trắc nghiệm và AI Chấm điểm dịch câu.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: ["/icon.svg"],
    apple: ["/icon.svg"],
  },
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
