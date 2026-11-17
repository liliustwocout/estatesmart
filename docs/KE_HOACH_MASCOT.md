# Kế hoạch Mascot cho estateSmartAI

Mascot là gương mặt của Trợ lý AI: một robot có đầu là căn nhà, ăng-ten là ghim bản đồ, tay chân ngắn, chuyên đi dò tiện ích quanh nhà (trường, chợ, công viên, y tế, xe buýt) cho cả gia đình.
Mascot xuất hiện ở landing (mỗi section một tư thế đang làm đúng việc của section đó), làm avatar ở trang Trợ lý,
và “chạy đi tìm” trong lúc 5 Agent đang chấm điểm.

> Từ 11/2026 dự án đổi chủ đề sang nhà ở cho gia đình (`docs/KE_HOACH_DOI_CHU_DE.md`). Câu nói và cách dùng tư thế trong tài liệu này đã theo chủ đề mới; 5 tư thế mới (mục 2) chưa vẽ. Người dùng chạm vào Mascot thì Mascot phản ứng thật.

## 1. Tài nguyên đã có

Tất cả nằm trong `design/mascot/` (không bị `npm run sync` quét, không vào bản build cho tới khi tích hợp).

| Đường dẫn | Nội dung |
|---|---|
| `design/mascot/index.html` | Trang xem trước: mở trực tiếp bằng trình duyệt, thử mọi tương tác, xem toàn bộ tư thế ở cả hai bảng màu |
| `design/mascot/thuong-hieu/*.svg` | 18 tư thế + `avatar.svg` (5 tư thế cho chủ đề nhà ở chưa vẽ, xem mục 2), **màu thương hiệu** (nền tối ấm, cam đất `#D39A6A`) — bản dùng cho web |
| `design/mascot/goc/*.svg` | Cùng bộ đó với bảng màu gốc đã duyệt (xanh `#2c6ab0`, cam `#e07b3c`) cho nền sáng |
| `design/mascot/y-tuong/*.svg` | Ba phương án ban đầu (A đã chọn, B và C để lưu) |
| `design/mascot/gen_mascot.py` | Nguồn duy nhất của hình: bộ phận dùng chung + tư thế + bảng màu. Sửa ở đây rồi chạy lại |
| `design/mascot/poses.js` | Tự sinh: chuỗi SVG từng tư thế cho trang xem trước |

Sinh lại sau khi sửa hình:

```bash
python design/mascot/gen_mascot.py design/mascot
```

Mỗi file SVG tự chứa (không `<use>`, không file ngoài), có sẵn hoạt ảnh CSS, tự đứng yên khi người dùng bật “giảm chuyển động”.
Mở được trong Figma/Illustrator để chỉnh tay nếu cần, nhưng chỉnh tay sẽ bị ghi đè lần sinh sau → sửa trong `gen_mascot.py`.

### Bảng màu thương hiệu

| Bộ phận | Màu gốc | Màu thương hiệu |
|---|---|---|
| Đầu | `#1d2d3f` | `#F4EFE6` kem |
| Màn hình mặt | `#0b121b` | `#1F1C19` mực |
| Mắt | `#8fd0ff` | `#F0B98A` cam đất sáng |
| Mái, ghim, miệng, má | `#e07b3c` | `#D39A6A` (`--accent`) |
| Thân, điểm nhấn phụ | `#2c6ab0` | `#8C6A52` nâu ca cao |
| Tay chân | `#111a24` | `#CFC6B8` kem đậm |

Lý do: web dùng nền tối `#1B1916`; đầu và tay chân màu tối của bản gốc sẽ chìm vào nền, nên đảo sang kem và giữ cam đất làm điểm nhấn,
giống `Robot.jsx` và `public/bot.svg` hiện có.

## 2. Bộ tư thế

| File | Tư thế | Dùng ở đâu |
|---|---|---|
| `00-dung-yen` | Đứng yên, nổi bồng bềnh | Mặc định |
| `01-chao` | Vẫy tay | Hero, mở trang Trợ lý, vừa tỉnh ngủ |
| `02-chay-tim` | Chạy, cầm kính lúp | Chờ phản hồi |
| `03-suy-nghi` | Tay chống cằm, ba chấm | Agent “Hiểu gia đình” |
| `04-tim-thay` | Nhảy, giơ ghim | Có ba căn đề xuất |
| `05-soi-tin-dang` | Soi tờ tin bằng kính lúp | Section `#gioi-thieu`; Agent “Sàng lọc căn” (soi tin rao) |
| `06-ong-nhom` | Ống nhòm, quay đầu quét | Nhìn quanh tìm tiện ích: khối “Hệ sinh thái quanh nhà” ở hồ sơ; tạm cho Agent “Sinh hoạt và đi lại”; để yên 10 giây |
| `07-do-dac` | Kéo thước dây | Diện tích căn, thông số trong hồ sơ; tạm cho Agent “Học hành và sức khoẻ” |
| `08-bieu-do` | Chỉ bảng cột | Agent “Chấm điểm sống”; điểm số ở hồ sơ |
| `09-ban-do` | Mở bản đồ, ghim rơi | Vòng 15 phút đi bộ; section `#ho-so-mau` |
| `10-ngon-cai` | Nháy mắt, ngón cái | CTA `#lien-he` |
| `11-dang-tra-loi` | Bong bóng thoại, miệng mấp máy | Câu trả lời đang hiện |
| `12-boi-roi` | Gãi đầu, giọt mồ hôi | Lỗi mạng, không có căn phù hợp |
| `13-an-mung` | Hai tay giơ cao, pháo giấy | Lưu hồ sơ, đặt lịch xem nhà xong |
| `14-duoc-vuot` | Mắt cười, tim bay | Rê chuột qua lại trên đầu |
| `15-chong-mat` | Mắt xoáy, sao quay | Bấm 5 lần liên tục |
| `16-bi-nhac-len` | Chân đung đưa | Đang bị kéo |
| `17-ngu-gat` | Mắt nhắm, chữ Z | 30 giây không ai đụng tới |
| `avatar` | Chỉ phần đầu | Avatar trong khung chat |
| `avatar-noi` | Chỉ phần đầu, miệng mấp máy | Avatar khi câu trả lời AI đang hiện |

**Chưa vẽ** (chủ đề nhà ở, mỗi tư thế một nhóm tiện ích; trong lúc chờ dùng tư thế tạm ở cột cuối):

| File | Tư thế | Dùng ở đâu | Tạm dùng |
|---|---|---|---|
| `18-deo-cap` | Đeo cặp sách, cầm sách | Agent “Học hành và sức khoẻ”; nhóm Trường | `07-do-dac` |
| `19-xach-gio` | Xách giỏ đi chợ | Agent “Sinh hoạt và đi lại”; nhóm Chợ, siêu thị | `06-ong-nhom` |
| `20-hop-y-te` | Ôm hộp chữ thập | Nhóm Y tế | `09-ban-do` |
| `21-xich-du` | Ngồi xích đu | Nhóm Công viên, vui chơi | `13-an-mung` |
| `22-cho-xe-buyt` | Đứng cạnh biển xe buýt, xem đồng hồ | Nhóm Đi lại | `09-ban-do` |

## 3. Tương tác

Đã chạy được trong `design/mascot/index.html`; component thật chép lại đúng logic này.

| Người dùng làm | Mascot phản ứng | Ghi chú |
|---|---|---|
| Di chuột bất kỳ đâu | Mắt nhìn theo (lệch tối đa 5px ngang, 4px dọc) | Gom về một `requestAnimationFrame`, như `Robot.jsx` |
| Rê qua lại trên đầu | Được vuốt 2,2 giây, câu “Hihi, nhột quá!” | Đổi hướng ≥ 4 lần trong 1,2 giây |
| Bấm một lần | Lần lượt chào → ăn mừng → ngón cái → tìm thấy, kèm câu nói | Mỗi phản ứng 1,4 giây |
| Bấm 5 lần trong 2 giây | Chóng mặt 2,6 giây | Khoá các phản ứng khác trong lúc đó |
| Kéo thả | Bị nhấc lên khi kéo quá 6px; thả ra nảy về chỗ rồi ăn mừng | `setPointerCapture`; giới hạn trong khung |
| Để yên 10 giây | Cầm ống nhòm nhìn quanh 3 giây | — |
| Để yên 30 giây | Ngủ gật | Di chuột / chạm là tỉnh dậy, chào |
| Bàn phím | Tab tới được, Enter/Space = bấm | Có vòng focus |

Trên điện thoại (không có hover): bỏ mắt nhìn theo chuột; chạm = bấm; vuốt ngang trên đầu = vuốt; nhấn giữ 400 ms rồi kéo = nhấc lên
(để không cướp thao tác cuộn trang).

## 4. Đặt Mascot vào từng trang

### Landing `/` (nguồn `design/Main.dc.html`)

Landing sinh từ `design/Main.dc.html`, nên không nhúng component React trực tiếp vào design. Hai cách, dùng cả hai:

- **Hình tĩnh có hoạt ảnh** cho từng section: `<img src="/mascot/05-soi-tin-dang.svg" alt="" width="160" height="190" loading="lazy">`.
  Hoạt ảnh CSS trong SVG vẫn chạy khi nhúng bằng `<img>`, không cần JS. Chép thư mục `thuong-hieu/` sang `public/mascot/`.
- **Mascot tương tác** ở hero: đặt một chỗ trống `<div data-mascot="hero"></div>` trong design; `src/entries/Main.jsx` gắn `<Mascot interactive />` vào đó bằng `createRoot`.

| Section | Tư thế | Hành vi |
|---|---|---|
| Hero | `01-chao` → `00-dung-yen` | Tương tác đầy đủ (mục 3) |
| `#gioi-thieu` | `05-soi-tin-dang` | Nói “Mình gom tin rao, trường, chợ, công viên quanh từng căn về một chỗ.” |
| `#quy-trinh` (7 bước) | Mỗi bước một tư thế (bảng dưới) | Đổi tư thế cùng lúc đổi bước, crossfade 240 ms |
| `#ho-so-mau` | `09-ban-do` | — |
| `#lien-he` | `10-ngon-cai` | Gửi form xong → `13-an-mung` |

7 bước của `#quy-trinh` (đã gắn theo đúng tên bước trên trang; nhóm có thể đổi trong `chapterData` của `design/Main.dc.html`):
Hiểu gia đình → `03-suy-nghi`; Sàng lọc → `05-soi-tin-dang`; Hồ sơ căn → `07-do-dac`; Hệ sinh thái tiện ích → `09-ban-do`;
Nhận định AI → `08-bieu-do`; So sánh → `06-ong-nhom`; Đặt lịch xem nhà → `04-tim-thay`.
Câu nói của từng bước đã theo chủ đề mới; tên bước trên trang đổi cùng phần landing (`docs/KE_HOACH_DOI_CHU_DE.md` mục 8).

### Trợ lý `/tro-ly/` (`src/assistant/`)

| Lúc | Hiện tại | Đổi thành |
|---|---|---|
| Avatar đầu khung chat | `Robot.jsx` (robot tròn) | `Mascot` dạng `avatar`, giữ logic mắt nhìn theo của `Robot.jsx` |
| Tin nhắn `thinking` (“Đang xem lại dữ liệu…”) | Ba chấm | Mascot nhỏ `02-chay-tim` cạnh dòng chữ |
| Checklist 5 Agent | Danh sách bước | Thêm Mascot lớn ở khung bản đồ bên phải, đổi tư thế theo `m.step`: `03-suy-nghi` (Nghe nhà mình cần gì…) → `05-soi-tin-dang` (Lọc tin rao…) → `07-do-dac` (Đo đường tới trường…, tạm cho `18-deo-cap`) → `06-ong-nhom` (Tìm chợ, công viên…, tạm cho `19-xach-gio`) → `08-bieu-do` (Chấm điểm sống…), chạy `02-chay-tim` giữa các bước |
| Có kết quả | Ba thẻ hiện ra | `04-tim-thay` 1,5 giây rồi Mascot thu nhỏ về góc |
| Câu trả lời đang hiện | — | Avatar mấp máy miệng (`avatar-noi`, bản chỉ đầu của `11-dang-tra-loi`) |
| Lỗi `/api/recommend` | Thông báo lỗi | `12-boi-roi` cạnh thông báo |

Đây là chỗ thể hiện ý tưởng chính: trong lúc chờ, Mascot **chạy đi tìm** trên khung bản đồ thay vì chỉ có vòng quay.
Bản đầu: Mascot chạy qua lại trên một dải đường phố mờ, dừng ở mỗi Agent để diễn tư thế tương ứng.
Khi vẽ tư thế mới, dải phố đổi thành khu dân cư (toà chung cư, trường, chợ, cây công viên, biển xe buýt), mỗi trạm đứng trước công trình của nhóm mình.
Bản sau: Mascot đi bộ trên bản đồ MapLibre **từ căn nhà tới từng tiện ích**, có bộ đếm phút đi bộ, bằng `maplibregl.Marker` chứa SVG.

### Hồ sơ căn nhà (hiện ở `/mat-bang/`, sẽ chuyển sang `/nha/`)

Một Mascot nhảy tới section đang xem (`src/mascot/JumpGuide.jsx`); câu nói ở `LINES` trong `src/entries/Listing.jsx`, khoá trùng `data-guide` trong `design/Listing.dc.html`.

| Khoá | Tư thế | Câu nói |
|---|---|---|
| `hero` | `04-tim-thay` | Đây là điểm sống của căn này. |
| `specs` | `07-do-dac` | Phòng ngủ, diện tích, pháp lý, xem giá trước nhé. |
| `rooms` | `05-soi-tin-dang` | Bấm từng phòng để xem bố trí. |
| `location` | `09-ban-do` | Vòng 15 phút đi bộ quanh nhà đây. |
| `eco` (trước là `comp`) | `06-ong-nhom` | Trường, chợ, công viên cách bao xa, xem ở đây. |
| `verdict` | `08-bieu-do` | Ưu điểm, và vài điều nên tự kiểm chứng. |
| `contact` | `10-ngon-cai` | Ưng rồi thì đặt lịch đi xem nhé! |

### Giọng nói

Nói với cả nhà ("bạn", "nhà mình"); không dùng từ kinh doanh (khách, doanh thu, đối thủ, mặt tiền); không hứa "đúng tuyến", "trường tốt", "an ninh", "sẽ tăng giá"; không nhắc tên hay tuổi của con người dùng.

### Quản trị `/quan-tri/`

Không đặt mascot.

## 5. Component

```
src/mascot/
  poses.js        # tự sinh từ gen_mascot.py (ESM): { slug: chuỗi SVG }, STYLE, META
  Mascot.jsx      # <Mascot pose="00-dung-yen" size={160} interactive={false} say="…" />
  useMascot.js    # máy trạng thái: idle / react / sequence / drag / sleep, hẹn giờ, chuỗi tư thế
  mascot.css      # bong bóng thoại, focus, kéo thả
```

- `gen_mascot.py` thêm đầu ra `src/mascot/poses.js` dạng `export`, để `npm run build` không phụ thuộc Python: file sinh ra **được commit**.
- Không thêm thư viện: hoạt ảnh là CSS trong SVG, tương tác là pointer events (cùng cách `Robot.jsx` đang làm). Dự án hiện không có thư viện animation, giữ vậy.
- Một phiên bản SVG mỗi lần render (`dangerouslySetInnerHTML` từ chuỗi do mình sinh, không có dữ liệu người dùng).
- API sự kiện để trang khác điều khiển: `window.dispatchEvent(new CustomEvent('mascot', { detail: { play: [['13-an-mung', 2000, 'Đã lưu hồ sơ!']] } }))`.

## 6. Hiệu năng và trợ năng

- Mỗi SVG ~3–6 KB; cả bộ < 100 KB chưa nén. Landing chỉ tải tư thế của section khi sắp cuộn tới (`loading="lazy"`).
- Tạm dừng hoạt ảnh khi Mascot ra khỏi màn hình (`IntersectionObserver` → `animation-play-state: paused`) và khi tab ẩn.
- `prefers-reduced-motion`: đứng yên ở tư thế hiện tại, không nổi, không chạy; tương tác vẫn đổi tư thế nhưng không có chuyển động.
- Mascot luôn là trang trí: `aria-hidden` ở hình nhỏ; Mascot tương tác có `role="button"` và `aria-label="Mascot, trợ lý của estateSmartAI"`.
  Câu nói trong bong bóng **không** đọc bằng trình đọc màn hình (đã có chữ trạng thái thật ở khung chat).
- Không chặn nội dung: Mascot không phủ lên chữ hay nút ở 390px; trên điện thoại thu nhỏ còn 96px hoặc ẩn ở section dày chữ.
- Tuân theo token chuyển động trong `src/styles/interaction.css` (`--ease-spring` cho nảy, ≤ 720 ms cho một lần chuyển).

## 7. Các giai đoạn

| # | Việc | Xong khi |
|---|---|---|
| 1 | `gen_mascot.py` sinh thêm `src/mascot/poses.js`; chép `thuong-hieu/` sang `public/mascot/`; viết `Mascot.jsx` + `useMascot.js` | Trang thử trong dev chạy đủ tương tác mục 3 |
| 2 | Trang Trợ lý: thay `Robot.jsx` bằng avatar Mascot; Mascot chạy tìm theo 5 Agent; tìm thấy / bối rối | Gửi một yêu cầu thật qua `/api/recommend`, Mascot diễn đúng thứ tự, kết thúc ở `04-tim-thay` — **xong** (`src/assistant/Hunt.jsx`) |
| 3 | Landing: hero tương tác + hình từng section + 7 bước quy trình | Mỗi section có Mascot, không section nào bị che chữ ở 1440 / 1024 / 768 / 390px — **xong** |
| 4 | Hồ sơ căn nhà: các tư thế ở mục 4 | Lưu hồ sơ → ăn mừng |
| 5 | Kiểm tra: reduced motion, bàn phím, cảm ứng, console sạch, Lighthouse không tụt điểm hiệu năng | — |
| 6 | Đổi chủ đề, phần chữ: câu nói, nhãn trạm, mô tả tư thế theo nhà ở cho gia đình | **xong** (dùng tư thế tạm) |
| 7 | Đổi chủ đề, phần hình: 5 tư thế mới (mục 2), nền khu dân cư cho `Hunt.jsx`, biểu tượng nhóm tiện ích | Thay hết tư thế tạm |
| 8 | (Tuỳ chọn) Mascot đi bộ trên bản đồ MapLibre từ căn nhà tới từng tiện ích; dải băng Mascot đi dạo phố dưới hero | — |

## 8. Cần nhóm quyết

- Chốt bảng màu: **thương hiệu** (đề xuất, hợp nền tối) hay **gốc**.
- ~~Tên mascot~~: đã chốt gọi là “Mascot”.
- Tư thế cho 7 bước của `#quy-trinh` (gợi ý ở mục 4).
- Câu nói của Mascot: giọng thân thiện, ngắn ≤ 6 chữ; nhóm duyệt danh sách câu trước khi đưa lên.
