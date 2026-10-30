# BookMind AI — Hệ thống AI Agent Đọc Sách & Tạo Lộ Trình Học Toàn Diện

Ứng dụng Full-stack TypeScript (**Next.js 15 + React + Tailwind CSS + Google Gemini SDK + IndexedDB + Supabase Cloud**) biến mỗi cuốn sách (kể cả file PDF nặng 80MB – 500MB+) thành một **Khóa học (Course)** riêng biệt.

## Các tính năng cốt lõi

1. **Mỗi cuốn sách / tài liệu = 1 Course độc lập**:
   - Quản lý nhiều khóa học trên Dashboard với thanh tiến độ, số chương, kho từ vựng.
   - Đọc file PDF dung lượng lớn (81.8MB+) trực tiếp trên trình duyệt theo từng trang (`pdfjs-dist` streaming), tự động giải phóng RAM sau mỗi trang và không bị giới hạn upload của server free.
2. **Màn hình học chuyên sâu từng Chương (5 Tab tương tác)**:
   - **📖 Nội dung & Diễn giải chuyên sâu**: Tóm tắt bối cảnh, chia nhỏ từng đoạn trích nguyên văn kèm bản dịch chuẩn, diễn giải sâu ý nghĩa nội dung và ghi chú văn phong + Khung hỏi đáp trực tiếp với Gia sư AI.
   - **📐 Ngữ pháp trong chương**: Phân tích cấu trúc ngữ pháp thực tế tác giả sử dụng trong chương, công thức, câu trích dẫn, lý do sử dụng và ví dụ mở rộng.
   - **🗂️ Từ vựng & Flashcard SRS**: Lọc từ vựng trọng tâm (B1–C2), phiên âm IPA, phát âm giọng đọc, nghĩa trong ngữ cảnh, collocations, synonyms và **Tự động tạo bộ thẻ Flashcard ôn tập ngắt quãng (thuật toán SM-2 giống Anki)**.
   - **✏️ Điền từ & Trắc nghiệm**: Bài tập điền từ khuyết trong câu gốc của sách (Cloze Test) có gợi ý và bài tập Trắc nghiệm (Vocabulary, Grammar, Reading Comprehension).
   - **🎯 Luyện dịch câu & AI Chấm điểm %**: Người học tự dịch câu trong sách; AI Agent chấm điểm độ gần đúng từ `0% - 100%` (Độ sát nghĩa, Ngữ pháp, Độ tự nhiên văn phong), chỉ ra điểm mạnh, điểm cần sửa và bảng đối chiếu từng cụm từ.
3. **Lưu trữ bền vững & Đồng nhất dữ liệu**:
   - **Local-First IndexedDB (`Dexie.js`)**: Lưu toàn bộ khóa học và tiến độ ngay trên máy, không mất khi tắt trình duyệt.
   - **Đồng bộ Cloud Supabase (Free Tier)**: Đồng bộ đa thiết bị theo thời gian thực.
   - **Sao lưu / Khôi phục file `.JSON`**: Xuất/nhập toàn bộ dữ liệu bất cứ lúc nào.

## Hướng dẫn chạy trên máy

```bash
cd C:\Users\340055\.gemini\antigravity\scratch\book-learning-agent
npm run dev
```

Mở trình duyệt tại: `http://localhost:3000`
