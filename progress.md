# Session Progress Log — BookMind AI

## 2026-11-15
- **[DONE] Khảo sát & Chẩn đoán toàn diện**:
  - Phân tích chi tiết `storage.ts`, `quotaManager.ts`, `geminiAgent.ts`, `page.tsx`, `ChapterWorkspace.tsx`, `AttendanceDashboard.tsx`, `PronunciationModal.tsx`, `ExamArena.tsx`, `admin/page.tsx`.
  - Xác định chính xác nguyên nhân lỗi AI báo bận trên điện thoại (Master Keys chỉ nằm ở `localStorage` của Laptop) và lỗi không đồng bộ điểm danh Supabase.
- **[DONE] Phase 1 — Cài đặt Skills, Rules & Planning Files**:
  - Cài đặt 19 bộ kỹ năng vào `.agents/skills/` (bao gồm `ui-ux-pro-max`, `design-system`, `ui-styling`, `planning-with-files`, bộ `superpowers`, bộ `anthropic-skills`, và `bookmind-core`).
  - Khởi tạo `AGENTS.md`, `.agents/rules/project-rules.md`, và `design-system/MASTER.md`.
- **[DONE] Phase 2 — Đồng bộ Điểm danh 2 chiều với Supabase (`StudyStreak` & `LearningActivity`)**:
  - Lưu trữ kép vào cả `public.user_quotas.data` (`streakData`, `activityLogs`) và `public.user_progress`.
  - Thêm hàm `syncAttendanceWithSupabase()` và nút đồng bộ trực tiếp trên `AttendanceDashboard.tsx`.
- **[DONE] Phase 3 — Sửa lỗi AI Agent báo "AI đang bận" & Ghi âm trên Điện thoại**:
  - Thêm `syncSystemAiKeysToCloud()` & `pullSystemAiKeysFromCloud()` trong `storage.ts`.
  - Tự động tải Master AI Keys trong `fetchAiAgent()` (`quotaManager.ts`) và fallback từ Supabase REST + Server Cache trong `geminiAgent.ts`.
  - Hỗ trợ đa định dạng ghi âm (`audio/mp4`, `audio/aac`, `audio/webm`) cho iOS Safari & Android trong `PronunciationModal.tsx` và `ExamArena.tsx`.
- **[DONE] Phase 4 — Nâng cấp UI/UX Pro Max & Mobile Responsive**:
  - Áp dụng phong cách *Editorial Literary Studio* trên `globals.css`, `page.tsx`, `AttendanceDashboard.tsx`, `ChapterWorkspace.tsx`, `FlashcardArena.tsx`, `BookLibraryView.tsx`, `LoginScreen.tsx`.
  - Bổ sung Thanh điều hướng đáy (Bottom Navigation Bar) trên Mobile và ngăn kéo chọn chương thu gọn trong `ChapterWorkspace.tsx`.


## Cập nhật đồng bộ Giọng đọc (TTS) & Chấm phát âm giữa Laptop và Mobile
- Nâng cấp `src/app/api/tts/route.ts`: Tự động chia câu dài (lên tới 1.800 ký tự) thành các đoạn `<= 180` ký tự và ghép nối buffer MP3 trực tiếp trên server, trả về `Content-Length` và `Accept-Ranges: bytes` tương thích hoàn toàn với iOS Safari và Android Chrome.
- Nâng cấp `src/lib/tts.ts`:
  - Chuyển sang ưu tiên phát luồng âm thanh chuẩn `/api/tts` làm nguồn chính trên **cả Laptop và Điện thoại** để 2 thiết bị phát ra **cùng 1 giọng đọc, ngữ điệu, tốc độ chuẩn 100%** (thay vì dùng `window.speechSynthesis` mặc định của hệ điều hành khiến điện thoại đọc giọng robot/Việt hóa khác hẳn laptop).
  - Bổ sung lọc phiên âm IPA `/.../` trong `cleanTextForSpeech` và nhận diện tiếng Việt có dấu (`vi-VN`), tiếng Trung phổ thông (`zh-CN`), Nhật (`ja-JP`), Hàn (`ko-KR`), Anh (`en-US`).
  - Thêm hàm `extractCleanSpeechTranscript` khử lỗi lặp chữ cộng dồn (`cumulative duplicate transcript`) của `SpeechRecognition` trên Chrome Android.
- Nâng cấp `src/components/PronunciationModal.tsx` & `src/components/ExamArena.tsx`: Đồng bộ `useRef` + `Promise` chờ `MediaRecorder` đóng gói xong `audioBase64` trước khi gửi lên AI chấm phát âm.


## Sửa lỗi 400 (Bad Request) trên `user_quotas` & `source.pdf`, Đồng bộ Sách Thư viện 2 chiều và Ẩn nút Soạn bài khi đã soạn xong
- Sửa lỗi `GET .../user_quotas?select=id,email,data... 400 (Bad Request)` và `on_conflict=email 400` trong `src/lib/storage.ts`: Bảng `public.user_quotas` lấy `email` làm khóa chính (`PRIMARY KEY`), không có cột `id`. Đã loại bỏ trường `id` khỏi truy vấn `select` và `upsert`.
- Sửa lỗi `400 ()` khi tải `source.pdf` / `chapter-X.json` trong `src/lib/storage.ts`: Bổ sung `listCourseStorageFiles(sourceId)` kiểm tra sự tồn tại của file trên bucket `book-chapters` trước khi gọi `.download(...)`.
- Đồng bộ tự động 2 chiều bài giảng giữa Sách gốc Thư viện và các bản sách User đã thêm (`isSameSharedBook`, `mergeSharedBookChapters`, `syncCourseLessonsWithCommunity`): Khi bất kỳ User A hay User B nào soạn bài mới hoặc bấm "+ Soạn thêm", toàn bộ bài giảng và từ vựng/bài tập bổ sung được đồng bộ sang Sách gốc và mọi bản sách tương ứng của các User khác.
- Trong `src/components/ChapterWorkspace.tsx`: Khi chương đã soạn bài (`Boolean(lesson)`), tự động ẩn nút **"Soạn lại bằng AI"** (thay bằng huy hiệu *"Đã soạn bài giảng"*), đồng thời giữ nguyên toàn bộ các nút **"+ Soạn thêm..."** ở từng phần Từ vựng, Điền từ, Trắc nghiệm và Luyện dịch.


## Bổ sung Hệ thống Unique Action Loading HUD & Auto-Dismissing Toast (1.8s)
- Tạo mới `src/lib/feedback.ts` và `src/components/ui/GlobalFeedbackOverlay.tsx`, gắn toàn cục tại `src/app/layout.tsx`.
- Hỗ trợ 4 hiệu ứng Loading đặc trưng theo ngữ cảnh thao tác:
  1. `delete` (Đỏ Rose/Cam): Khi xóa khóa học, xóa chương sách, xóa tài khoản.
  2. `edit` (Vàng Amber/Emerald): Khi lưu chỉnh sửa văn bản gốc chương, lưu cài đặt, cập nhật Master AI Keys.
  3. `api` (Indigo/Tím Violet): Tự động hiển thị khi gọi bất kỳ AI API nào trong `fetchAiAgent` kèm bộ đếm giây trực tiếp (`0.1s...`).
  4. `sync` (Xanh Emerald/Cyan): Khi thêm sách từ Thư viện, làm mới Thư viện, đồng bộ Điểm danh, sao lưu/khôi phục JSON.
- Toast thông báo có thanh đếm ngược thu nhỏ mượt mà (`bookmindToastShrink`) và tự động tắt sau `1.8 giây` (1-2s).
