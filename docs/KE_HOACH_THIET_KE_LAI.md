# Kế hoạch thiết kế lại giao diện estateSmartAI

Tài liệu này ghi lại hướng thiết kế lại web (landing `/`, trợ lý `/tro-ly/`, hồ sơ `/mat-bang/`), dựa trên ba bộ quy tắc thiết kế
[hallmark](https://github.com/nutlope/hallmark), [taste-skill](https://github.com/Leonxlnx/taste-skill),
[impeccable](https://github.com/pbakaus/impeccable), và 20 nguyên tắc UX & Animation.

## 1. Bối cảnh (pre-flight)

| Mục | Nội dung |
|---|---|
| Người xem | Chủ doanh nghiệp F&B, bán lẻ nhỏ tại TP.HCM, xem trên điện thoại nhiều |
| Hành động chính | **Bắt đầu tư vấn** với Trợ lý AI |
| Hành động phụ | Xem hồ sơ mặt bằng mẫu |
| Chế độ (impeccable) | Landing = *Persuade* (được phép có một khoảnh khắc chuyển động chủ đạo). Trợ lý & Hồ sơ = *Operate* (chuyển động chỉ để phản hồi và giữ mạch) |
| Giữ lại | Bảng màu tối ấm, ảnh kiến trúc, cặp chữ Familjen Grotesk + Instrument Serif (serif chỉ cho số và wordmark) |
| Nguồn giao diện | `design/*.dc.html` → `npm run sync` → `src/generated/`. Sửa ở `design/`, không sửa file sinh ra |

## 2. Những gì đổi, và vì sao

| Hiện tại | Thay bằng | Quy tắc |
|---|---|---|
| Nhãn chữ in hoa giãn chữ (`VỀ DỰ ÁN`, `QUY TRÌNH 7 BƯỚC`) ở mọi khối | Bỏ nhãn trên tiêu đề; nhãn còn lại viết thường, không giãn chữ | hallmark floor 9, impeccable “eyebrow” |
| Mũi tên dính vào chữ link (`BẮT ĐẦU TƯ VẤN →`) | Nút có icon mũi tên tách riêng, icon tự chuyển động | hallmark floor 10 |
| Chuỗi meta nối bằng `·` | Câu bình thường | hallmark floor 10 |
| Collage ảnh xoay nghiêng, chồng nhau + carousel | Dải ảnh thẳng hàng, zoom nhẹ khi hover | taste: không xoay, chồng, carousel |
| Ba “con số lớn” xếp hàng | So sánh *Cách làm hiện nay* ↔ *Với estateSmartAI* | impeccable: tránh hero‑metric template |
| Màu, font viết rời rạc trong `style` | Token trên `:root` | hallmark floor 1 |
| Không có trạng thái focus / hover / nhấn thống nhất | Lớp tương tác dùng chung `src/styles/interaction.css` | impeccable craft floor |
| Không có logo, chỉ có chữ | Logo mark + wordmark + favicon (mục 5) | — |

Thứ tự khối trên landing (xen kẽ ảnh và chữ, không hai khối ảnh liền nhau):
hero (ảnh) → giới thiệu (chữ + dải ảnh nhỏ) → so sánh (chữ) → quy trình 7 bước (ảnh, **khoảnh khắc chủ đạo**) → 5 AI Agent (chữ) → hồ sơ mẫu (nửa ảnh) → chân trang + CTA.

## 3. Hệ chuyển động

Token (trong `src/styles/interaction.css`):

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--dur-tap` | 90 ms | Nhấn xuống |
| `--dur-1` | 140 ms | Hover, đổi màu |
| `--dur-2` | 240 ms | Đổi trạng thái thường |
| `--dur-3` | 420 ms | Mở menu, chuyển bước |
| `--dur-4` | 720 ms | Vào trang (một lần) |
| `--ease-out` | `cubic-bezier(.16,1,.3,1)` | Vào |
| `--ease-in-out` | `cubic-bezier(.65,0,.35,1)` | Di chuyển giữa hai vị trí |
| `--ease-spring` | `cubic-bezier(.34,1.56,.64,1)` | Nảy nhẹ sau khi nhả nút (chỉ phần tử nhỏ) |

Luật cứng: chỉ animate `transform`, `opacity` (và `clip-path` cho menu); không `transition: all`; nội dung luôn hiện khi tắt chuyển động;
`prefers-reduced-motion` tắt mọi dịch chuyển; hover chỉ áp dụng trong `@media (hover: hover)`; không fade‑in khi cuộn.

## 4. 20 nguyên tắc → áp dụng ở đâu

| # | Nguyên tắc | Áp dụng |
|---|---|---|
| 1 | Squash & stretch | Nút co `scale(.96)` khi nhấn rồi nảy lại; chấm bước đang chọn “bẹp rồi giãn” khi đổi bước |
| 2 | Anticipation | Mũi tên trong nút lùi 2px khi nhấn trước khi lao tới; nút menu xoay icon trước khi menu mở |
| 3 | Staging | Gradient tối góc dưới trái hero dồn mắt vào tiêu đề và nút chính; mỗi màn hình chỉ một hành động chính |
| 4 | Pose to pose | Quy trình 7 bước và khối hồ sơ mẫu là các “tư thế” rõ ràng, chuyển bằng crossfade |
| 5 | Follow through | Tiêu đề hero lên trước, câu dẫn và nút theo sau; các link trong menu trễ dần |
| 6 | Slow in & slow out | Mọi chuyển động dùng `--ease-out` / `--ease-in-out`, không tuyến tính |
| 7 | Moving in arcs | Số bước và tiêu đề bước đi vào theo cung (dịch + xoay quanh gốc dưới), theo hướng tiến/lùi |
| 8 | Secondary action | Ảnh bước đang chọn trôi chậm từ 1.06 về 1; vạch màu tự vẽ dưới link khi hover |
| 9 | Snappy timing | Phản hồi ≤ 140 ms, đổi trạng thái 240 ms, không quá 720 ms |
| 10 | Exaggerated feedback | Vòng focus 2px tương phản, nút nhấn rõ, nút đổi sang màu nhấn khi hover |
| 11 | Solid drawing in 3D | Bóng đổ có độ lệch và nguồn sáng thống nhất; mô hình 3D ở trang Trợ lý giữ nguyên |
| 12 | Overall appeal | Một hệ token, một kiểu nút chính, một bán kính bo, logo riêng |
| 13 | Fitts's law | Nút chính cao ≥ 52px, full‑width trên mobile; CTA luôn ở header dính |
| 14 | Bigger hit areas | Link chữ có vùng bấm mở rộng bằng `::after`; chấm bước 44×44 |
| 15 | Hick's law | Header chỉ 2 link + 1 CTA; hero 1 nút chính + 1 link phụ |
| 16 | Miller's law | 7 bước, 5 Agent, chân trang 4 nhóm |
| 17 | Doherty threshold | Ảnh các bước render sẵn (xếp chồng) nên đổi bước tức thì, không chờ tải |
| 18 | Postel's law | Quy trình nhận click chấm, nút, phím ←/→, vuốt; Esc đóng menu |
| 19 | Jakob's law | Logo trái về trang chủ, menu phải, link có gạch dưới, nút trước/sau quen thuộc |
| 20 | Frequency of use | “Bắt đầu tư vấn” luôn trong tầm tay qua header dính; phím tắt cho người dùng quen |

## 5. Logo

- **Ý tưởng:** một ô mặt bằng vuông (lô đất nhìn từ trên) bị cắt bởi dấu `/` của wordmark `estateSmart/AI`; một chấm đánh dấu vị trí được chọn ở góc còn lại. Đọc được: mặt bằng + phân tích + điểm được chọn.
- **Tệp:** `public/logo.svg` (mark), `public/favicon.svg`. Mark vẽ bằng nét, dùng `currentColor` khi nhúng trong header để tự đổi màu sáng/tối.
- **Kiểm tra:** rõ ở 16px (favicon), cân với chữ 17px trong header.

## 6. Các giai đoạn

1. Lớp dùng chung: `interaction.css` (token chuyển động, focus, nhấn, reduced motion) + logo — import ở cả 3 entry.
2. Landing (`design/Main.dc.html`): viết lại theo mục 2–4.
3. Trợ lý & Hồ sơ: làm lại theo chế độ *Operate* (mục 7).
4. Kiểm tra: 1440, 1024, 768, 390px; hero + nút chính nằm trong màn hình 1280×800; phím Tab đi hết; reduced motion; không cuộn ngang; console sạch.

> `design/*.dc.html` trong repo là nguồn duy nhất; không tải đè từ canvas hay file bên ngoài.

## 7. Trang Trợ lý AI và Hồ sơ mặt bằng

Hai trang này là nơi làm việc, nên chuyển động chỉ dùng để phản hồi thao tác và giữ mạch, không có hiệu ứng trình diễn khi vào trang.

### Trợ lý AI (`design/Chat.dc.html`)

| # | Nguyên tắc | Áp dụng |
|---|---|---|
| 1 | Squash & stretch | Ghim mặt bằng bật lên kiểu “bẹp rồi giãn”; dấu ✓ của Agent nảy khi xong |
| 2 | Anticipation | Ba chấm “đang soạn” ~0,4 giây trước câu hỏi tiếp theo |
| 4 | Pose to pose | Bộ chuyển Bản đồ / 3D có nền trượt; thẻ mặt bằng đang chọn hiện lại khi đổi lựa chọn |
| 5 | Follow through | Các gợi ý trả lời và ba thẻ kết quả xuất hiện lần lượt |
| 7 | Moving in arcs | Nút xoay mô hình 3D quay khối theo cung 45°, có chuyển động mượt |
| 10 | Exaggerated feedback | Thẻ đang chọn có viền đậm và bóng; nút gửi mờ đi khi ô nhập trống |
| 13–14 | Fitts, hit area | Cả thẻ kết quả là vùng bấm; ghim có vùng bấm rộng hơn hình |
| 15 | Hick | Tối đa 5 gợi ý mỗi câu hỏi |
| 16 | Miller | Tiến độ chia 5 đoạn |
| 18 | Postel | Gõ “2” hiểu là chọn gợi ý số 2; bấm vào câu đã trả lời để sửa |
| 20 | Frequency of use | Phím số 1–5 để chọn nhanh; “Phiên mới” có Hoàn tác thay vì hộp xác nhận |

Câu hỏi tự do sau khi có kết quả nhận được câu trả lời trung thực rằng bản mô phỏng chưa hỗ trợ hỏi đáp tự do.

### Hồ sơ mặt bằng (`design/Listing.dc.html`)

| # | Nguyên tắc | Áp dụng |
|---|---|---|
| 1 | Squash & stretch | Icon “Lưu hồ sơ” bẹp rồi bật; dấu ✓ khi gửi xong |
| 4 | Pose to pose | Bộ chọn hồ sơ có nền trượt; ảnh từng không gian chuyển mờ |
| 6 | Slow in & out | Thanh điểm và thanh phân khúc giá chạy từ 0 khi đổi hồ sơ |
| 8 | Secondary action | Vạch màu dưới không gian đang chọn tự vẽ ra |
| 13 | Fitts | Nút “Đặt lịch khảo sát” luôn ở header dính và trong hero |
| 17 | Doherty | Nút gửi đổi ngay sang “Đang gửi” kèm vòng xoay |
| 18 | Postel | Số điện thoại nhận dấu cách, dấu chấm, +84; lỗi hiện ngay dưới ô và tự hết khi sửa đúng |
| 19 | Jakob | Breadcrumb “Kết quả tư vấn / Hồ sơ”; số nguồn là link tới danh sách nguồn |
| 20 | Frequency of use | Đổi hồ sơ ở mọi vị trí cuộn; phím ↑/↓ để duyệt các không gian |

Thông báo sau khi gửi nói rõ đây là bản mô phỏng, yêu cầu chưa tới chủ nhà (trước đây trang hứa “chủ nhà sẽ liên hệ trong 24 giờ”).

## 8. Hiệu ứng cuộn ở phần giới thiệu (tham khảo stillform.homes)

- **Hero dính phía sau:** hero và phần giới thiệu nằm chung khối `.intro`; hero `position: sticky`, phần giới thiệu nền be `#EDE6D6` trượt lên che dần.
- **Mây:** `public/assets/images/cloud-*-beige.webp` đặt ở mép trên phần be; hai lớp mây trồi lên với tốc độ khác nhau khi phần be đi vào màn hình.
- **Ảnh lớn thu nhỏ vào câu:** phần giới thiệu dài 340svh, sân khấu dính 100svh. Theo tiến độ cuộn `p` (làm mượt bằng nội suy mỗi khung hình):
  - `p` 0–0,46: khung ảnh gần kín màn hình, lần lượt đổi 4 ảnh (có bộ đếm 01/04).
  - `p` 0,5–0,8: khung thu nhỏ khít vào ô ảnh trong câu, dùng `clip-path: inset()` cho khung và `transform` cho ảnh bên trong.
  - `p` 0,6–0,94: từng chữ trong câu sáng dần.
- **Không có chuyển động / tắt JS:** câu, ô ảnh và mây hiển thị tĩnh như bình thường; hiệu ứng chỉ bật khi trình duyệt không yêu cầu giảm chuyển động.
