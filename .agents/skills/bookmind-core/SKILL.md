---
name: bookmind-core
description: "Kiến trúc lõi của dự án BookMind AI: Bộ định tuyến AI 4 cổng (Gemini, Groq, OpenRouter, SiliconFlow), cơ chế lưu trữ kép Local + Supabase (Kho A Database & Kho B Storage), đồng bộ Điểm danh (StudyStreak) đa thiết bị, và đồng bộ Master AI Keys cho thiết bị di động. Sử dụng kỹ năng này khi sửa đổi logic lưu trữ, gọi AI API, điểm danh, hoặc phân quyền học viên."
---

# BookMind AI Core Architecture Skill

## 1. Đồng Bộ Master AI Keys Giữa Laptop & Điện Thoại (Mobile Fix)

### Vấn đề gốc
Admin cấu hình 4 khóa hệ thống (`masterGeminiApiKey`, `groqApiKey`, `openRouterApiKey`, `siliconFlowApiKey`) tại `/admin` -> trước đây chỉ lưu vào `localStorage` trên trình duyệt Laptop. Khi mở trên Điện thoại, `localStorage` trống nên `fetchAiAgent()` gửi `masterApiKey: ""` -> Server không có key nào trong pool và báo lỗi `"Tất cả các cổng AI (Gemini, Groq, OpenRouter, SiliconFlow) đều đang bận"`.

### Giải pháp chuẩn trong BookMind AI
1. **Cloud System AI Config (`src/lib/storage.ts`)**:
   - Hàm `syncSystemAiKeysToCloud(settings)` lưu các khóa AI hệ thống lên Supabase Storage (`book-chapters/__system_ai_config.json`) và bản ghi dự phòng trong `public.courses` (`id = '__bookmind_system_config__'`, luôn được lọc bỏ khỏi danh sách khóa học hiển thị).
   - Hàm `pullSystemAiKeysFromCloud()` tải khóa AI hệ thống từ Supabase về thiết bị hiện tại và hợp nhất vào `localStorage` (`book_agent_settings_v1`).
2. **Client-side Auto-Hydration (`src/lib/quotaManager.ts`)**:
   - Trong `fetchAiAgent()`, nếu cả 4 khóa (`masterGeminiApiKey`, `groqApiKey`, `openRouterApiKey`, `siliconFlowApiKey`) và khóa cá nhân đều rỗng, tự động `await pullSystemAiKeysFromCloud()` trước khi gọi `/api/agent/*`.
3. **Server-side Key Cache & Fallback (`src/lib/geminiAgent.ts`)**:
   - Server lưu cache các khóa hợp lệ vào `globalThis.__bookMindServerKeysCache` và tự động truy vấn Supabase nếu request từ mobile gửi lên vẫn thiếu key.

---

## 2. Đồng Bộ Điểm Danh Đa Thiết Bị (`StudyStreak` & `LearningActivity`)

### Cơ chế hoạt động (`src/lib/storage.ts`)
- Dữ liệu điểm danh gồm:
  - `StudyStreak`: `{ currentStreak, longestStreak, lastStudyDate, activeDates: string[] }`
  - `LearningActivity[]`: Danh sách tối đa 80 hoạt động gần nhất (`id`, `date`, `timestamp`, `type`, `title`, `CourseId`, `score`, `xpEarned`).
- **Lưu trữ kép trên Supabase**:
  1. Lưu trực tiếp trong cột JSONB `data` của bảng `public.user_quotas` (`streakData` và `activityLogs` trong `UserQuotaAccount`) — bảng này luôn tồn tại và mở quyền đồng bộ cho học viên.
  2. Đồng thời upsert vào bảng `public.user_progress` (nếu bảng đã được khởi tạo trong Supabase).
- **Hợp nhất thông minh (`syncAttendanceWithSupabase`)**:
  - Hợp nhất `activeDates` từ Local + Cloud (`Array.from(new Set([...local.activeDates, ...cloud.activeDates])).sort()`).
  - Tính toán lại chính xác `currentStreak` (đếm lùi từ `today` hoặc `yesterday` theo múi giờ địa phương `YYYY-MM-DD`) và `longestStreak`.
  - Hợp nhất `activityLogs` theo `id` duy nhất, sắp xếp mới nhất lên đầu.
  - Phát sự kiện `window.dispatchEvent(new CustomEvent("bookmind:attendance-updated"))` để UI cập nhật tức thì.

---

## 3. Ghi Âm Đa Nền Tảng (iOS Safari & Android Chrome)
- Safari trên iOS không hỗ trợ `audio/webm`. Khi khởi tạo `MediaRecorder` trong `PronunciationModal.tsx` và `ExamArena.tsx`, luôn chọn định dạng theo thứ tự ưu tiên:
  1. `audio/webm;codecs=opus`
  2. `audio/webm`
  3. `audio/mp4`
  4. `audio/aac`
  5. Để trống `options` (mặc định của trình duyệt) nếu không khớp.
