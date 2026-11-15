# Quy Tắc Dự Án BookMind AI (`.agents/rules/project-rules.md`)

## 1. Nguyên Tắc Tối Ưu Token & Đọc Code
- Luôn tham khảo `AGENTS.md` và `design-system/MASTER.md` trước khi sửa UI hoặc logic.
- Với các file lớn (`src/lib/storage.ts`, `src/lib/geminiAgent.ts`, `src/lib/quotaManager.ts`, `src/components/ChapterWorkspace.tsx`, `src/app/page.tsx`, `src/app/admin/page.tsx`), luôn dùng `grep_search` để xác định vị trí dòng trước khi dùng `read_file` với `StartLine`/`EndLine`.
- Cập nhật `task_plan.md`, `findings.md`, và `progress.md` khi thực hiện các tính năng lớn nhiều bước.

## 2. Quy Chuẩn UI/UX Pro Max & Mobile Responsive
- **Chủ đề**: *Editorial Literary Studio* — nền tối sâu ấm áp (`#0B0F17`, `#111622`, `#161D2B`), viền mảnh `1px solid rgba(255,255,255,0.08)`, chữ phân cấp rõ ràng (`#F8FAFC` tiêu đề, `#CBD5E1` nội dung, `#94A3B8` phụ chú).
- **Tránh "AI Slop"**: Không dùng gradient 3 màu tím-hồng-xanh chói mắt cho các thẻ thông thường; chỉ dùng màu nhấn có chủ đích (`indigo-500` cho hành động chính, `amber-500` cho chuỗi điểm danh/thành tích, `emerald-500` cho hoàn thành/đồng bộ).
- **Mobile-First**:
  - Đảm bảo hiển thị mượt trên màn hình từ `360px` đến `430px` (iPhone / Android).
  - Các vùng chạm (buttons, tabs, inputs) tối thiểu cao `40px–44px`.
  - Danh sách chương trong `ChapterWorkspace` phải thu gọn thành ngăn kéo (collapsible drawer) trên mobile để nội dung bài học hiển thị ngay lập tức.
  - Có thanh điều hướng đáy (Bottom Navigation Bar) trực quan trên màn hình di động.

## 3. Quy Chuẩn Đồng Bộ Cloud (Supabase) & AI Agent Trên Mobile
- **Điểm danh (`StudyStreak` & `LearningActivity`)**: Luôn đồng bộ 2 chiều (pull + merge + push) với Supabase qua `public.user_quotas.data` và `public.user_progress`.
- **AI Agent Keys trên Mobile**: Khi thiết bị di động chưa có Master API Keys trong `localStorage`, hệ thống phải tự động tải cấu hình AI hệ thống từ Supabase Cloud (`pullSystemAiKeysFromCloud()`) trước khi gửi request tới `/api/agent/*`, đồng thời server (`geminiAgent.ts`) giữ bộ nhớ đệm key và tự fallback lấy từ Supabase nếu request gửi lên thiếu key.
- **Tương thích Trình duyệt Di động (iOS Safari / Android Chrome)**: Không hardcode `mimeType: 'audio/webm'` trong `MediaRecorder`; luôn dùng hàm dò định dạng âm thanh tương thích (`getSupportedAudioMimeType`).
