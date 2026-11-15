# Task Plan: Tối Ưu Hóa BookMind AI (Skills, UI/UX Pro Max, Đồng Bộ Điểm Danh Supabase & Sửa Lỗi Mobile AI)

## Goal
Nâng cấp toàn diện dự án `D:\ImproveSkills\book-mind-ai`:
1. Tích hợp hệ thống **Skills & Rules** chuẩn (`07 SKILL.md`, `08 Rules`, `09 Anthropic Skills`, `10 Superpowers`, `11 UI UX Pro Max`, `12 planning-with-files`) để tối ưu ngữ cảnh và tiết kiệm token.
2. Thiết kế lại giao diện theo chuẩn **UI/UX Pro Max** (*Editorial Literary Studio*) — loại bỏ sự lòe loẹt kiểu AI đại trà, tối ưu hóa **Mobile Responsive** trên mọi màn hình.
3. Sửa triệt để lỗi **dữ liệu Điểm danh (`StudyStreak` & `LearningActivity`) không đồng bộ Supabase** giữa các thiết bị.
4. Sửa triệt để lỗi **AI Agent báo "AI đang bận" trên điện thoại** (trong khi chạy bình thường trên laptop) và lỗi ghi âm trên iOS Safari.

---

## Phases

### Phase 1: Khởi tạo Skills, Rules & Hệ thống Quản lý Kế hoạch (Token Optimization)
**Status:** complete
- [x] Tải và cài đặt 19 bộ kỹ năng vào `.agents/skills/` (`ui-ux-pro-max`, `design-system`, `ui-styling`, `planning-with-files`, bộ `superpowers`, bộ `anthropic-skills`, và `bookmind-core`).
- [x] Thiết lập `AGENTS.md` và `.agents/rules/project-rules.md` với chỉ mục dòng (Line Index) giúp tiết kiệm token.
- [x] Khởi tạo `design-system/MASTER.md` và bộ 3 file `task_plan.md`, `findings.md`, `progress.md`.

### Phase 2: Đồng bộ Điểm danh 2 chiều với Supabase (`StudyStreak` & `LearningActivity`)
**Status:** complete
- [x] Mở rộng `UserQuotaAccount` trong `src/types/course.ts` để lưu trữ `streakData?: StudyStreak` và `activityLogs?: LearningActivity[]` trực tiếp trong cột JSONB `public.user_quotas.data`.
- [x] Bổ sung bảng `public.user_progress` vào `SUPABASE_ADMIN_SQL_SCHEMA` trong `src/app/admin/page.tsx`.
- [x] Xây dựng hàm `syncAttendanceWithSupabase()` và `recalculateStreakFromDates()` trong `src/lib/storage.ts` để kéo (pull), hợp nhất (union activeDates, tính lại currentStreak/longestStreak, gộp activityLogs theo ID) và đẩy (push) lên cả `public.user_quotas` lẫn `public.user_progress`.
- [x] Bảo toàn `streakData` và `activityLogs` khi cập nhật hạn ngạch trong `src/lib/quotaManager.ts`.
- [x] Tích hợp tự động đồng bộ và nút "Đồng bộ Cloud" trực tiếp trên `src/components/AttendanceDashboard.tsx`.

### Phase 3: Sửa lỗi AI Agent báo "AI đang bận" & Ghi âm trên Điện thoại (Mobile)
**Status:** complete
- [x] Bổ sung `syncSystemAiKeysToCloud()` và `pullSystemAiKeysFromCloud()` trong `src/lib/storage.ts` để tự động đồng bộ 4 khóa hệ thống (`masterGeminiApiKey`, `groqApiKey`, `openRouterApiKey`, `siliconFlowApiKey`) từ Laptop Admin lên Supabase Cloud (`book-chapters/__system_ai_config.json` & `public.courses` row `__bookmind_system_config__`).
- [x] Cập nhật `fetchAiAgent()` trong `src/lib/quotaManager.ts` để tự động tải khóa hệ thống từ Cloud nếu `localStorage` trên điện thoại đang trống.
- [x] Cập nhật `src/lib/geminiAgent.ts` với Server-side Key Cache (`globalThis.__bookMindServerKeysPool`), tự động fallback lấy key từ Supabase trên server nếu client thiếu key, và bổ sung các model Groq ổn định (`llama-3.3-70b-versatile`, `qwen/qwen3-32b`).
- [x] Sửa lỗi `MediaRecorder` cứng nhắc `audio/webm` trong `src/components/PronunciationModal.tsx` và `src/components/ExamArena.tsx` để hỗ trợ `audio/mp4` / `audio/aac` trên iOS Safari.

### Phase 4: Nâng cấp Giao diện UI/UX Pro Max & Tối ưu Responsive Mobile
**Status:** complete
- [x] Cập nhật hệ thống CSS tokens & tiện ích trong `src/app/globals.css`.
- [x] Tối ưu `src/app/page.tsx` (Header tinh gọn, Bottom Navigation Bar cố định cho Mobile, bố cục thẻ khóa học Editorial sang trọng).
- [x] Tối ưu `src/components/AttendanceDashboard.tsx` (Lịch 7 ngày chuẩn responsive mobile, thẻ thống kê tinh tế, trạng thái đồng bộ Cloud).
- [x] Tối ưu `src/components/ChapterWorkspace.tsx` (Ngăn kéo chọn chương thu gọn trên mobile, thanh 6 tab cuộn mượt, giao diện bài đọc & bài tập không bị vỡ khung trên điện thoại).
- [x] Tối ưu `src/components/FlashcardArena.tsx`, `src/components/BookLibraryView.tsx`, `src/components/LoginScreen.tsx`.

### Phase 5: Kiểm thử Build & Xác minh Hoàn thiện
**Status:** complete
- [x] Dọn dẹp thư mục tạm `scratch/gh_skills`.
- [x] Hoàn tất kiểm tra TypeScript (`tsc --noEmit`) và Next.js Production Build (`npm run build`) không có lỗi.
