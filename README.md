# Nền tảng Thực nghiệm Tâm lý Số — Dự án KHKT / VISEF (Lĩnh vực BEHA)

Ứng dụng Web thực nghiệm tâm lý nhận thức đối chứng ngẫu nhiên đo trước – sau (**Randomized Controlled Pre-test / Post-test Design**), đánh giá tác động tức thời của việc xem video ngắn lên khả năng ức chế nhận thức và trí nhớ làm việc ở học sinh THPT.

## 1. Cấu trúc dự án & Triển khai nhanh (Chi phí 0 đồng)

Dự án viết bằng **HTML5 / CSS3 / Vanilla ES6 JavaScript thuần** (không cần Node.js hay bước build):

- **Chạy trực tiếp trên máy phòng Tin học (Offline 100%):** Mở trực tiếp file `index.html` bằng Chrome hoặc Microsoft Edge.
- **Triển khai trực tuyến miễn phí (Vercel / Netlify):** Kéo thả toàn bộ thư mục dự án lên [Netlify Drop](https://app.netlify.com/drop) hoặc import từ GitHub vào Vercel (Framework Preset: `Other`, Output Directory: `.`).

### Danh sách tệp chính
- `index.html` — Giao diện SPA 5 màn hình & Modal quản trị GVHD
- `css/styles.css` — Giao diện phòng Lab tối giản (`#1E293B`), vô hiệu hóa CSS transition/animation khi đo
- `js/config.js` — Thông số chuẩn hóa (40 Stroop, 60 Go/No-Go, 40 2-Back, ISI = 1500 ms, 600s can thiệp) & Chế độ Demo
- `data/reading-content.js` — Bài đọc khoa học trung tính (~2.300 âm tiết) cho Nhóm 2 & 20 clip ngắn khoa học nhịp nhanh cho Nhóm 1
- `js/generators.js` — Thuật toán sinh chuỗi kích thích ngẫu nhiên cân bằng & không trùng lặp giữa Pre-test và Post-test
- `js/testEngine.js` — Bộ máy đo mili-giây bằng `performance.now()` + `requestAnimationFrame()`, chống giữ phím (`event.repeat`) & gắn cờ ngoại lai (`<150 ms`, `>2000 ms`)
- `js/metrics.js` — Tính Hiệu ứng nhiễu Stroop, Commission/Omission Error, `SD_RT`, và chỉ số độ nhạy `d'` (Macmillan & Creelman)
- `js/intervention.js` — Màn hình can thiệp khóa đếm ngược 600s (Nhóm 1: Video ngắn; Nhóm 2: Đọc văn bản; Nhóm 3: Nghỉ ngơi)
- `js/storage.js` & `js/researcher.js` — Lưu cục bộ (`localStorage`), đồng bộ Google Sheets và xuất `.CSV` chuẩn JASP
- `google-apps-script/Code.gs` — Mã nguồn kết nối Google Sheets

---

## 2. Thiết lập lưu dữ liệu tự động lên Google Sheets

1. Tạo một bảng tính **Google Sheets** mới.
2. Vào menu **Tiện ích mở rộng (Extensions) → Apps Script**.
3. Xóa mã mặc định, dán toàn bộ nội dung file `google-apps-script/Code.gs` và nhấn Lưu.
4. Nhấn **Triển khai (Deploy) → Tùy chọn triển khai mới (New deployment)** → chọn loại **Ứng dụng web (Web app)**:
   - *Thực thi với tư cách (Execute as):* **Tôi (Me)**
   - *Người có quyền truy cập (Who has access):* **Bất kỳ ai (Anyone)**
5. Sao chép **URL ứng dụng web** (`/exec`).
6. Mở Web App → bấm nút **⚙ GVHD / Quản trị** ở góc trên bên phải → tab **Google Sheets & Video** → dán URL và bấm **Kiểm tra kết nối** → **Lưu**.

Mỗi khi một học sinh hoàn tất Post-test, hệ thống tự động tạo và ghi thêm dữ liệu vào 2 trang tính:
- `Summary_JASP`: Mỗi học sinh 1 dòng đầy đủ biến nền, Pre-test, Post-test, hiệu số `Δ`, và tỷ lệ ngoại lai.
- `Raw_Trials`: Toàn bộ từng lượt bấm (~280 dòng/học sinh) kèm nhãn `outlier_flag` (`VALID`, `TOO_FAST`, `TOO_SLOW`, `NA`).

---

## 3. Chế độ Phòng Lab Chính thức vs Chế độ Demo Hội đồng

Trong **⚙ GVHD / Quản trị → Cài đặt Phiên đo**:
- **Chính thức (Phòng Lab — Mặc định):**
  - Vòng làm thử: 6 lượt/bài (có phản hồi Đúng/Sai)
  - Pre-test & Post-test: 40 Stroop • 60 Go/No-Go • 40 2-Back • Nghỉ giữa bài 20s (ẩn phản hồi)
  - Can thiệp khóa cứng: **600 giây (10:00)**
- **Thử nghiệm / Demo Hội đồng:**
  - Vòng làm thử: 4 lượt/bài
  - Pre-test & Post-test: 8 Stroop • 12 Go/No-Go • 10 2-Back • Nghỉ giữa bài 5s
  - Can thiệp khóa cứng: **20 giây** (phù hợp demo trực tiếp trước ban giám khảo trong ~3 phút).

---

## 4. Nhập dữ liệu vào phần mềm JASP để phân tích thống kê

1. Tải file **`VISEF_Summary_JASP.csv`** từ tab **Dữ liệu Máy trạm & Thống kê** (hoặc xuất CSV từ trang tính `Summary_JASP` trên Google Sheets).
2. Lọc bỏ các phiên thử nghiệm (`mode = DEMO`), chỉ giữ lại `mode = OFFICIAL`.
3. Mở **JASP → Open → Computer** và chọn file `.csv` (dấu thập phân dùng dấu chấm `.` tương thích trực tiếp với JASP).
4. Thực hiện quy trình kiểm định giả thuyết:
   - **Kiểm tra phân phối chuẩn (Shapiro-Wilk):** `ANOVA → Assumption Checks → Normality tests` với biến phụ thuộc `delta_*` và biến phân nhóm `group_id` (hoặc `group_code`).
   - **Nếu đạt chuẩn:** Dùng **One-way ANOVA** + **Post Hoc Tests (Tukey)** + đánh dấu `Estimates of effect size (η²)`.
   - **Nếu không đạt chuẩn:** Dùng **Kruskal-Wallis Test** + **Dunn's Post Hoc Comparisons**.
   - **Phân tích điều tiết thói quen (Câu hỏi 2):** Lọc theo `group_id = 1` và so sánh các phân tầng `video_habit_group` (`LOW (< 30p/ngày)` vs `HIGH (> 2h/ngày)`).
