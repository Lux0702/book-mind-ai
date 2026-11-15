# BookMind AI — Master Design System (`UI/UX Pro Max`)

> **Triết lý thiết kế (Design Direction)**: **Editorial Literary Studio (Phòng Đọc Học Thuật Đương Đại)**
> Loại bỏ hoàn toàn cảm giác "AI-generated template" (lạm dụng dải màu neon tím-hồng-xanh, viền phát sáng lòe loẹt, quá nhiều huy hiệu hỗn loạn). Thay vào đó là không gian học tập sâu lắng, sắc nét, lấy cảm hứng từ **Linear, Readwise Reader, Notion & Apple Books Dark Mode**.

---

## 1. Bảng Màu Hệ Thống (Semantic Color Tokens)

### Bề mặt (Surfaces — Warm Obsidian & Slate Ink)
- **Canvas Background (`--bg-canvas`)**: `#090D16` (Đen mực sâu, dịu mắt khi đọc lâu)
- **Primary Surface (`--bg-surface-1`)**: `#0F1523` (Bề mặt thẻ bài học, sidebar, bảng điều khiển)
- **Elevated Surface (`--bg-surface-2`)**: `#161E31` (Thẻ tương tác, hộp thoại, trạng thái hover)
- **Subtle Glass (`--bg-glass`)**: `rgba(15, 21, 35, 0.82)` kết hợp `backdrop-blur-xl`

### Viền & Phân cách (Borders & Dividers)
- **Hairline Border**: `rgba(255, 255, 255, 0.07)` (`border-white/[0.07]` hoặc `border-slate-800/80`)
- **Interactive / Focus Border**: `rgba(99, 102, 241, 0.45)` (`border-indigo-500/45`)
- **Warm Highlight Border**: `rgba(245, 158, 11, 0.35)` (`border-amber-500/35`)

### Màu Nhấn Có Chủ Đích (Intentional Accents)
- **Primary Action (Indigo Ink)**: `#6366F1` (`indigo-500` / `indigo-600`) — Dùng cho nút hành động chính, tab đang chọn.
- **Literary / Streak Accent (Warm Amber)**: `#F59E0B` (`amber-500` / `amber-400`) — Dùng cho Chuỗi ngày học (Streak), Điểm kinh nghiệm (XP), Từ vựng quan trọng.
- **Mastery / Sync Success (Sage Emerald)**: `#10B981` (`emerald-500` / `emerald-400`) — Dùng cho trạng thái đã đồng bộ Cloud, hoàn thành chương, đáp án đúng.
- **Alert / Error (Crimson Rose)**: `#F43F5E` (`rose-500`) — Dùng cho cảnh báo lỗi, câu trả lời sai.

### Phân Cấp Chữ (Typography Contrast — WCAG AAA/AA)
- **Primary Text**: `#F8FAFC` (`text-slate-50`) — Tiêu đề, nội dung bài đọc chính.
- **Secondary Text**: `#CBD5E1` (`text-slate-300`) — Giải thích, bản dịch, mô tả.
- **Muted / Metadata Text**: `#94A3B8` (`text-slate-400`) — Nhãn phụ, thời gian, bộ đếm.

---

## 2. Quy Chuẩn Bố Cục & Mobile-First Responsive

1. **Kích thước vùng chạm (Touch Targets)**:
   - Mọi nút tương tác trên màn hình `< 768px` phải có chiều cao tối thiểu `40px`–`44px` (`min-h-[40px] sm:min-h-[44px]`).
   - Khoảng cách giữa các nút liền kề tối thiểu `8px` (`gap-2`).
2. **Hệ thống Điều hướng (Navigation)**:
   - **Desktop (`>= 768px`)**: Thanh Header dính (`sticky top-0`) tích hợp chuyển đổi 3 phân khu chính (`Sách Của Tôi`, `Thư Viện Sách`, `Điểm Danh & Tiến Độ`) cùng thông tin hạn ngạch gọn gàng.
   - **Mobile (`< 768px`)**: Thanh Header tối giản ở trên + **Thanh Điều Hướng Đáy (Bottom Navigation Bar)** cố định giúp ngón tay cái chuyển tab tức thì mà không bị tràn chữ.
3. **Không gian Chương học (`ChapterWorkspace`)**:
   - **Trên Mobile**: Danh sách mục lục chương được thu gọn thành một **Thanh Chọn Chương Thông Minh (Collapsible Chapter Drawer/Selector)** ở đầu trang thay vì chiếm cố định nửa màn hình.
   - Thanh 6 Tab chức năng (`Tổng quan`, `Từ vựng`, `Ngữ pháp`, `Thảo luận`, `Điền từ`, `Tự dịch`) cuộn ngang mượt mà với chỉ báo rõ ràng, không xuống dòng lộn xộn.
4. **Bảng Điểm Danh (`AttendanceDashboard`)**:
   - Lịch 7 ngày thích ứng hoàn hảo trên màn hình nhỏ (`360px`) với bố cục lưới `grid-cols-7 gap-1.5 sm:gap-3`, hiển thị rõ trạng thái đồng bộ Supabase Cloud.

---

## 3. Anti-Patterns Cần Tránh (Banned Patterns)
- Không dùng `bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500` trên các nút bấm hay tiêu đề thông thường.
- Không đặt quá 3 badge màu sắc cạnh nhau trên một dòng thẻ khóa học.
- Không dùng `overflow-hidden` làm mất thanh cuộn dọc trên trang mobile khi mở bàn phím ảo.
