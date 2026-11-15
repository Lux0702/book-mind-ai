# Findings & Root Cause Analysis — BookMind AI

## 1. Nguyên Nhân Lỗi AI Agent Báo "AI Đang Bận" Trên Điện Thoại (Mobile)
- **Triệu chứng**: Trên Laptop các tính năng AI (Phân tích chương, Từ vựng, Ngữ pháp, Chat, Chấm điểm) chạy bình thường, nhưng khi mở trên Điện thoại thì báo `"Tất cả các cổng AI (Gemini, Groq, OpenRouter, SiliconFlow) đều đang bận. Vui lòng thử lại sau giây lát!"`.
- **Nguyên nhân gốc (`src/lib/geminiAgent.ts:489` & `src/app/admin/page.tsx:240`)**:
  1. Dự án không lưu khóa API trong biến môi trường server mà Admin nhập 4 khóa (`masterGeminiApiKey`, `groqApiKey`, `openRouterApiKey`, `siliconFlowApiKey`) tại trang `/admin`.
  2. Hàm `handleSaveMasterSettings` chỉ gọi `saveAppSettings(settings)`, tức là **chỉ lưu vào `localStorage` của trình duyệt trên Laptop**.
  3. Khi người dùng đăng nhập trên **Điện thoại**, `localStorage` của điện thoại có giá trị `""` cho cả 4 khóa. Hàm `fetchAiAgent` (`src/lib/quotaManager.ts:1026`) gửi `masterApiKey: ""` lên server -> `extractProviderKeysPool` nhận được mảng rỗng (`attempts.length === 0`) và ném ngay thông báo lỗi `"Tất cả các cổng AI ... đều đang bận"`.
  4. Ngoài ra, danh sách model Groq trong `geminiAgent.ts:315` thiếu các model ổn định như `llama-3.3-70b-versatile` và `qwen/qwen3-32b`, và `MediaRecorder` trong `PronunciationModal.tsx` hardcode `audio/webm` gây lỗi ghi âm trên iOS Safari.

## 2. Nguyên Nhân Lỗi Dữ Liệu Điểm Danh Không Đồng Bộ Supabase
- **Nguyên nhân gốc (`src/lib/storage.ts:402-515`)**:
  1. `getStudyStreak()` và `getLearningActivities()` chỉ đọc từ `localStorage`, hoàn toàn không có hàm tải dữ liệu điểm danh từ Supabase về khi mở ứng dụng trên thiết bị khác.
  2. `recordLearningActivity()` cố gắng `upsert` vào bảng `public.user_progress`, nhưng bảng này chưa được khai báo trong `SUPABASE_ADMIN_SQL_SCHEMA` (`src/app/admin/page.tsx:58-90`). Trong khi đó, bảng `public.user_quotas` (có cột `data JSONB`) đã tồn tại sẵn và có RLS cho phép đồng bộ từ client.
  3. Khi `quotaManager.ts` đồng bộ tài khoản lên `public.user_quotas`, nó ghi đè `data` bằng đối tượng `account` mà chưa kèm dữ liệu `streakData` và `activityLogs`.

## 3. Vấn Đề Giao Diện "AI Hóa" & Lỗi Responsive Trên Mobile
- **Giao diện hiện tại**: Sử dụng quá nhiều gradient neon `from-indigo-500 via-purple-500 to-pink-500`, bóng đổ phát sáng mạnh, và quá nhiều huy hiệu nhỏ gây rối mắt.
- **Lỗi Mobile Responsive**:
  - Ở `ChapterWorkspace.tsx`, cột danh sách chương chiếm toàn bộ phần đầu trang trên mobile, đẩy nội dung bài học xuống sâu bên dưới.
  - Thanh điều hướng chính (`page.tsx`) và các tab bài học bị chật trên màn hình `< 390px`.
  - Ô nhập từ Cloze (`w-28` cố định) và các nút điều khiển Flashcard dễ tràn hoặc khó chạm trên màn hình điện thoại.
