# BookMind AI — Agent Rules & Project Architecture (`AGENTS.md`)

> **Mục tiêu tối ưu Token**: File này cung cấp bản đồ kiến trúc cô đọng và quy tắc bắt buộc cho AI Agent. **KHÔNG đọc toàn bộ các file >500 dòng** (`storage.ts`, `geminiAgent.ts`, `quotaManager.ts`, `ChapterWorkspace.tsx`, `page.tsx`, `admin/page.tsx`) nếu chỉ sửa một hàm cụ thể — hãy tra cứu bảng định vị dòng (Line Index) bên dưới hoặc dùng `grep_search` trước khi `read_file` với `StartLine`/`EndLine`.

---

## 1. Kiến Trúc Cốt Lõi (Core Stack)

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v3.4.
- **Lưu trữ đa tầng (Hybrid Storage)**:
  - **Local**: `localStorage` (settings, session, streak cache, quota cache) + `Dexie.js` IndexedDB (`BookAgentDB` cho courses & PDF blobs cục bộ).
  - **Cloud (Supabase)**:
    - **Kho A (Database Tables)**: `public.courses` (metadata khóa học + config hệ thống), `public.user_quotas` (tài khoản, mật khẩu, quota, streak & activity logs trong cột `data JSONB`), `public.user_progress` (bảng đồng bộ điểm danh).
    - **Kho B (Storage Bucket `book-chapters`)**: Lưu nội dung JSON chi tiết của từng chương (`{courseId}_ch_{chapterId}.json`) và cấu hình AI hệ thống (`__system_ai_config.json`) để giải phóng dung lượng Database.
- **Bộ định tuyến AI 4 Cổng (Multi-Provider AI Router — `src/lib/geminiAgent.ts`)**:
  - Tự động xoay vòng và fallback giữa 4 nhà cung cấp: **Google Gemini**, **Groq**, **OpenRouter**, **SiliconFlow**.
  - Mọi route `/api/agent/*` đều gọi qua `fetchAiAgent()` (`src/lib/quotaManager.ts`) ở client và `generateTextWithRotation()` (`src/lib/geminiAgent.ts`) ở server.

---

## 2. Bản Đồ File & Chỉ Mục Dòng (Token-Saving File Map)

| File | Vai trò chính | Lưu ý khi đọc / sửa |
|------|---------------|---------------------|
| `src/types/course.ts` | Toàn bộ TypeScript interfaces (`Course`, `Chapter`, `StudyStreak`, `LearningActivity`, `UserQuotaAccount`, `AppSettings`) | Đọc file này đầu tiên (~240 dòng) khi làm việc với dữ liệu. |
| `src/lib/storage.ts` | Dual-storage Local + Supabase (`courses`, `book-chapters`, `StudyStreak`, `LearningActivity`, `AppSettings`, Cloud AI Keys sync) | File lớn (~1550 dòng). Dùng `grep_search` tìm tên hàm (`getStudyStreak`, `syncAttendanceWithSupabase`, `saveAppSettings`, `pullSystemAiKeysFromCloud`) trước khi đọc. |
| `src/lib/quotaManager.ts` | Quản lý tài khoản học viên, hạn ngạch AI (`UserQuotaAccount`), đồng bộ `public.user_quotas`, và hàm client `fetchAiAgent` | File lớn (~1520 dòng). Hàm `fetchAiAgent` nằm ở khoảng dòng 995–1120. |
| `src/lib/geminiAgent.ts` | Server-side AI Router (`extractProviderKeysPool`, `generateTextWithRotation`) + tất cả các hàm xử lý AI (Analyze, Translate, Quiz, Flashcard, Grammar, Pronunciation, Chat) | File lớn (~1900 dòng). Router core nằm ở dòng 1–520; các prompt AI nằm từ dòng 520 trở đi. |
| `src/app/page.tsx` | Trang chủ (`HomePage`): điều hướng chính, quản lý state khóa học, tạo khóa học từ PDF/DOCX/TXT, đồng bộ Cloud | Khoảng 1300 dòng. |
| `src/components/ChapterWorkspace.tsx` | Không gian học tập từng chương (6 tabs: Tổng quan, Từ vựng, Ngữ pháp, Thảo luận, Điền từ Cloze, Tự dịch & Chấm điểm) | File lớn (~2450 dòng). Xem state ở dòng 1–250, render chính từ dòng 1400 trở đi. |
| `src/components/AttendanceDashboard.tsx` | Bảng điều khiển Điểm danh & Chuỗi ngày học (`StudyStreak`, lịch 7 ngày, nhật ký hoạt động, đồng bộ Supabase) | Khoảng 420 dòng. |
| `src/components/BookLibraryView.tsx` | Thư viện sách cộng đồng & sách cá nhân | Khoảng 715 dòng. |
| `src/components/FlashcardArena.tsx` | Đấu trường Ôn tập Thẻ từ (Flashcard 3D flip + TTS + Phát âm) | Khoảng 400 dòng. |
| `src/components/ExamArena.tsx` | Phòng thi tổng hợp 4 kỹ năng (Nghe, Nói, Đọc, Viết) | Khoảng 1100 dòng. |
| `src/app/admin/page.tsx` | Trang quản trị hệ thống (`/admin`), cấp tài khoản, cấu hình Master AI Keys & Supabase SQL Schema | Khoảng 1600 dòng. |

---

## 3. Quy Tắc Bắt Buộc Cho AI Agent (Mandatory Rules)

1. **Tiết kiệm Token (Progressive Disclosure)**:
   - Không đọc toàn bộ file lớn nếu chỉ cần sửa 1 component/hàm. Luôn dùng `grep_search` để lấy số dòng, sau đó dùng `read_file` với `StartLine` và `EndLine` (khoảng 100–200 dòng).
   - Trước khi bắt đầu tác vụ lớn (>5 bước), kiểm tra `task_plan.md`, `findings.md`, và `progress.md` theo kỹ năng `planning-with-files`.
2. **Thiết kế Giao diện theo chuẩn `design-system/MASTER.md` (`ui-ux-pro-max`)**:
   - **CẤM sử dụng "AI Slop"**: Không lạm dụng dải màu neon tím-hồng-xanh (`from-indigo-500 via-purple-500 to-pink-500`) tràn lan, không dùng bóng phát sáng lòe loẹt hay quá nhiều badge rối mắt.
   - Sử dụng phong cách **Editorial Literary Studio (Warm Obsidian & Amber/Indigo)**: Nền tối ấm sang trọng (`#0B0F17`, `#111622`, `#161D2B`), viền mảnh tinh tế (`border-white/[0.08]`), điểm nhấn Vàng Hổ Phách (`amber-500`) cho thành tích/điểm danh và Lam Chàm (`indigo-500`) cho hành động chính.
   - **Mobile-First Responsive**: Mọi nút bấm trên mobile phải đạt chuẩn chạm tối thiểu `44x44px`, không bị tràn ngang (`overflow-x-hidden`), thanh điều hướng và danh sách chương phải thu gọn thông minh trên màn hình nhỏ (`< 768px`).
3. **Đồng bộ Supabase & Đa Thiết Bị (Laptop + Mobile)**:
   - Mọi thay đổi về **Điểm danh (`StudyStreak`, `LearningActivity`)** phải được lưu vào cả `localStorage` VÀ đồng bộ hai chiều với Supabase (`public.user_quotas.data` + `public.user_progress`) qua `syncAttendanceWithSupabase()`.
   - **Master AI Keys (`masterGeminiApiKey`, `groqApiKey`, `openRouterApiKey`, `siliconFlowApiKey`)** khi lưu ở `/admin` phải được đồng bộ lên Cloud (`__system_ai_config.json` / `__bookmind_system_config__`) để thiết bị di động (Mobile) tự động tải về khi gọi `fetchAiAgent()`, tuyệt đối không để xảy ra lỗi rỗng API key trên điện thoại.
   - Ghi âm giọng nói (`MediaRecorder`) trên Mobile phải kiểm tra `MediaRecorder.isTypeSupported(...)` (hỗ trợ cả `audio/mp4` cho iOS Safari và `audio/webm` cho Android/Desktop).

---

## 4. Danh Mục Kỹ Năng Đã Cài Đặt (`.agents/skills/`)

- `bookmind-core`: Kiến trúc AI Router 4 cổng, Dual-Storage Kho A/B, đồng bộ Điểm danh & Quota của BookMind AI.
- `ui-ux-pro-max`, `design-system`, `ui-styling`: Hệ thống thiết kế UI/UX chuyên nghiệp & kiểm định khả năng truy cập, responsive.
- `planning-with-files`: Quản lý kế hoạch đa phiên làm việc qua `task_plan.md`, `findings.md`, `progress.md`.
- `brainstorming`, `writing-plans`, `executing-plans`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `requesting-code-review`, `receiving-code-review` (Bộ kỹ năng **Superpowers**).
- `pdf`, `docx`, `xlsx`, `pptx`, `doc-coauthoring`, `frontend-design` (Bộ kỹ năng xử lý tài liệu & giao diện **Anthropic Skills**).
