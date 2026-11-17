# Kế hoạch đổi chủ đề: từ mặt bằng kinh doanh sang nhà ở cho gia đình

**Hiện tại:** estateSmartAI giúp chủ quán F&B, cửa hàng bán lẻ nhỏ tìm **mặt bằng kinh doanh** (chấm điểm vị trí, đối thủ, lối tiếp cận, giá thuê).

**Hướng mới:** estateSmartAI giúp **gia đình** tìm **căn hộ chung cư hoặc nhà đất để ở**, đánh giá theo **hệ sinh thái tiện ích quanh nhà**:
trường học, chợ và siêu thị, y tế, công viên và khu vui chơi, đi lại. Mỗi tiện ích có khoảng cách và thời gian đi bộ cụ thể, kèm nguồn.

Câu định vị đề xuất: *"Chọn nhà theo cuộc sống của cả nhà, không chỉ theo giá và diện tích."*

Tài liệu này liệt kê những gì phải đổi (docs, dữ liệu, chấm điểm, giao diện, SEO), theo thứ tự làm, và các câu hỏi cần chốt trước.

---

## 0. Các quyết định đã chốt

Chốt ngày 17/11/2026 theo **đề xuất mặc định** dưới đây (chưa có ý kiến khác). Muốn đổi mục nào thì sửa ở đây trước khi làm giai đoạn liên quan.

| # | Câu hỏi | Đã chốt | Ảnh hưởng tới |
|---|---|---|---|
| 1 | Mua, thuê hay cả hai? | **Cả hai**, hỏi ngay câu đầu; giá bán tính bằng tỷ, giá thuê bằng triệu/tháng | Schema, câu hỏi, chấm điểm ngân sách |
| 2 | Khu vực thí điểm | **Giữ Vinhomes Ocean Park 1** (đã có dữ liệu OSM, bản đồ, ảnh); mở rộng sau | Dữ liệu mẫu, `fetch-osm.mjs` |
| 3 | Đổi đường dẫn `/mat-bang/`? | Đổi sang **`/nha/`**, chuyển hướng 301 từ `/mat-bang/` | nginx, sitemap, link chia sẻ cũ |
| 4 | Giữ tên estateSmartAI, logo, bảng màu? | **Giữ**. Chỉ đổi khẩu hiệu và nội dung | Landing, meta |
| 5 | Đo khoảng cách | Giai đoạn đầu: đường chim bay × 1,3, quy ra phút đi bộ (80 m/phút). Ghi rõ là **ước lượng**. Chi tiết: `docs/PHUONG_PHAP_CHAM_DIEM.md` | Engine, giao diện |
| 6 | Dữ liệu cũ (30 mặt bằng mô phỏng, link chia sẻ, yêu cầu khảo sát) | Bỏ dữ liệu mặt bằng, làm 30 căn mô phỏng mới; link chia sẻ cũ báo "hết hiệu lực"; giữ bảng `leads` | `db.mjs`, `server.mjs` |

---

## 1. Người dùng và nhu cầu

| Mục | Cũ | Mới |
|---|---|---|
| Người xem | Chủ doanh nghiệp F&B, bán lẻ nhỏ | Gia đình trẻ có con nhỏ; gia đình nhiều thế hệ; vợ chồng sắp cưới, sắp có con |
| Câu hỏi họ đặt | "Mặt bằng này có đông khách không?" | "Con đi học bao xa? Đi chợ, siêu thị có tiện không? Có công viên cho con chơi không? Ông bà đi khám có gần không? Đi làm mất bao lâu?" |
| Hành động chính | Bắt đầu tư vấn | Bắt đầu tư vấn (giữ) |
| Hành động phụ | Xem hồ sơ mặt bằng mẫu | Xem hồ sơ căn nhà mẫu |
| Kết quả | 3 mặt bằng đáng khảo sát | 3 căn đáng đi xem, kèm "bản đồ một ngày của gia đình" |

### Hồ sơ gia đình quyết định trọng số

Cùng một căn nhưng mỗi gia đình chấm khác nhau. Trợ lý hỏi thành phần gia đình rồi đổi trọng số:

| Gia đình có | Tăng trọng số |
|---|---|
| Con dưới 6 tuổi | Mầm non, sân chơi trẻ em, phòng khám nhi |
| Con 6–15 tuổi | Tiểu học, THCS, công viên, khu thể thao |
| Con 15–18 tuổi | THPT, xe buýt (con tự đi) |
| Ông bà, người lớn tuổi | Bệnh viện, nhà thuốc, công viên đi bộ, chợ gần |
| Bố mẹ đi làm xa | Thời gian tới nơi làm việc, xe buýt, đường lớn |
| Có ô tô | Chỗ đỗ ô tô trong toà hoặc trước nhà |

---

## 2. Bảng đổi thuật ngữ

Dùng thống nhất ở docs, giao diện, prompt, trang quản trị.

| Cũ | Mới |
|---|---|
| Mặt bằng | Căn nhà (chung); căn hộ (chung cư); nhà phố, liền kề, biệt thự (nhà đất) |
| Chủ quán, chủ doanh nghiệp | Gia đình, anh/chị |
| Mô hình kinh doanh | Nhu cầu ở / thành phần gia đình |
| Giá thuê (triệu/tháng) | Giá bán (tỷ) hoặc giá thuê (triệu/tháng) |
| Thẩm định mặt bằng | Đánh giá căn nhà, chấm điểm sống |
| Phân tích cạnh tranh | Hệ sinh thái tiện ích |
| Lưu lượng khách theo giờ | Một ngày của gia đình (lộ trình đưa đón, đi chợ, đi chơi) |
| Khả năng tiếp cận (dải phân cách, quay đầu, vỉa hè) | Đi lại (xe buýt, đường lớn, thời gian tới nơi làm việc, chỗ đỗ xe) |
| Khảo sát thực địa | Đi xem nhà |
| Không gian, công năng đề xuất | Phòng, bố trí căn |
| Điểm phù hợp 0–100 | Điểm sống 0–100 (kèm điểm từng nhóm tiện ích) |

---

## 3. Docs cần đổi

| File | Việc | Mức độ |
|---|---|---|
| `README.md` | Câu mô tả dự án và link tài liệu mới (**đã làm**); bảng đường dẫn (`/nha/` thay `/mat-bang/`) và mục quản trị đổi cùng lúc với code ở giai đoạn 5 | Viết lại phần đầu |
| `docs/HUONG_DAN_CICD.md` mục 14–16 | Đổi **cùng commit với code** của từng giai đoạn (2, 3, 5), để tài liệu vận hành luôn đúng với thứ đang chạy | Theo giai đoạn |
| `docs/KE_HOACH_DOI_CHU_DE.md` | Tài liệu này; cập nhật khi chốt mục 0 | Mới |
| `docs/PHUONG_PHAP_CHAM_DIEM.md` | Thay `HUONG_DAN_CICD.md` mục 15.5: nhóm tiện ích, ngưỡng, trọng số theo hồ sơ gia đình, cách ước lượng thời gian đi bộ, giới hạn dữ liệu | **Đã viết** (đặc tả cho giai đoạn 3) |
| `docs/HUONG_DAN_CICD.md` mục 14 | 14.2a: phạm vi trợ lý mới; 14.4: dữ liệu gửi đi gồm thành phần gia đình (không gửi tên, tuổi cụ thể của con) | Sửa |
| `docs/HUONG_DAN_CICD.md` mục 15 | Đổi "mặt bằng" → "căn nhà"; cột CSV mới (mục 5); thêm 15.x "Quản lý tiện ích" (tab mới); 15.5 chuyển sang file phương pháp chấm điểm, để lại một dòng link | Viết lại |
| `docs/HUONG_DAN_CICD.md` mục 16 | "Đặt lịch khảo sát thực địa" → "Đặt lịch xem nhà"; vai trò người gửi: người mua / người thuê | Sửa nhẹ |
| `docs/KE_HOACH_THIET_KE_LAI.md` | Mục 1 (người xem), mục 2 (thứ tự khối landing), mục 7 (tên trang, form) theo chủ đề mới. Phần hệ chuyển động và 20 nguyên tắc giữ nguyên | Sửa có chọn lọc |
| `docs/KE_HOACH_MASCOT.md` | Câu mở đầu, bảng tư thế, bảng vị trí theo 5 Agent mới; thêm 5 tư thế mới (chi tiết ở mục 9.7) | Sửa nhiều bảng |
| `docs/KE_HOACH_TRIEN_KHAI.md` | Hạ tầng không đổi | Giữ |

Mục 15 và 16 của `HUONG_DAN_CICD.md` thực ra là tài liệu sản phẩm, không phải CI/CD. Cân nhắc tách thành `docs/HUONG_DAN_QUAN_TRI.md` (dữ liệu, quản trị, yêu cầu khách, Telegram) để file CI/CD chỉ còn hạ tầng.

---

## 4. Hệ sinh thái tiện ích: nhóm, bán kính, nguồn

Mỗi nhóm có **bán kính tính điểm** theo phút đi bộ (thành phố 15 phút) và hiện **tiện ích gần nhất + số lượng trong bán kính**.
Bán kính trong bảng dưới là mức tham khảo; ngưỡng dùng để chấm (`tốt` / `xa` cho từng loại) ở `docs/PHUONG_PHAP_CHAM_DIEM.md` mục 2.

| Nhóm | Gồm | Bán kính | Thẻ OSM |
|---|---|---|---|
| Giáo dục | Mầm non, tiểu học, THCS, THPT, đại học | Mầm non, tiểu học 10 phút; THCS, THPT 15 phút | `amenity=kindergarten/school/university/college`; tách cấp học theo tên ("Mầm non", "Tiểu học", "THCS", "THPT", "Liên cấp") |
| Mua sắm hằng ngày | Chợ, siêu thị, cửa hàng tiện lợi, trung tâm thương mại | Chợ, siêu thị 10 phút; TTTM 20 phút | `amenity=marketplace`, `shop=supermarket/convenience/mall/department_store` |
| Y tế | Bệnh viện, phòng khám, nhà thuốc | Nhà thuốc 5 phút; phòng khám 10 phút; bệnh viện 3 km | `amenity=hospital/clinic/doctors/pharmacy` |
| Xanh và vui chơi | Công viên, hồ, sân chơi trẻ em, khu vui chơi | 10 phút | `leisure=park/playground/garden`, `natural=water` |
| Thể thao | Bể bơi, gym, sân bóng, sân cầu lông | 15 phút | `leisure=sports_centre/fitness_centre/pitch/swimming_pool` |
| Đi lại | Điểm xe buýt, ga metro, đường lớn | Xe buýt 5 phút; metro 15 phút | `highway=bus_stop`, `railway=station` |
| Ăn uống | Quán ăn, cà phê (tham khảo, không chấm nặng) | 10 phút | `amenity=restaurant/cafe/fast_food` |
| Điểm trừ (giai đoạn 2) | Đường cao tốc, đường sắt, khu công nghiệp, bãi rác sát nhà | 200–500 m | `highway=motorway/trunk`, `railway=rail`, `landuse=industrial` |

**Tiện ích nội khu** (bể bơi, gym, sân chơi trong toà, hầm đỗ xe) không có trong OSM: nhập theo **dự án / toà** ở trang quản trị, hiện riêng là "trong toà".

**Giới hạn phải ghi rõ trên giao diện và trong prompt:**
- OSM ở Việt Nam thiếu nhiều điểm (chợ cóc, nhà thuốc nhỏ, trường tư). Trang quản trị cho phép thêm và đánh dấu "đã kiểm chứng".
- Khoảng cách là ước lượng, chưa theo đường đi thực.
- **Trường đúng tuyến:** trường công lập ở Hà Nội tuyển sinh theo địa bàn phường/xã. Hệ thống không biết tuyến, chỉ nói "gần". Mỗi hồ sơ nhắc gia đình kiểm tra với phường.

---

## 5. Dữ liệu và schema

### 5.1 Bảng căn nhà (thay `listings`)

| Bỏ (chỉ dùng cho kinh doanh) | Thêm |
|---|---|
| `frontage_m`, `road_m`, `divider`, `uturn_m`, `two_way`, `sidewalk_m`, `moto_slots`, `kitchen`, `suited`, `deposit_months`, `min_term_years` | `deal` (`ban` / `thue`), `price_billion` (giá bán), `rent_million` (giá thuê), `bedrooms`, `bathrooms`, `floor` (tầng của căn), `building` (toà / dự án), `direction` (hướng ban công / cửa), `legal` (sổ hồng, HĐMB, đang chờ sổ), `furnished` (thô, cơ bản, đầy đủ), `mgmt_fee` (phí dịch vụ/m²), `car_parking` (hầm, trước nhà, gần, không) |

`type` mới: `can_ho`, `studio`, `duplex`, `penthouse`, `nha_pho`, `lien_ke`, `biet_thu`.
Giữ: `code`, `name`, `zone`, `lat`, `lng`, `area_m2`, `floors` (nhà đất), `yard_m2`, `image`, `status`, `updated`, `note`.

Đổi cấu trúc nhiều nên **tạo bảng mới `homes`** thay vì `ALTER` từng cột; bảng `listings` cũ bỏ đi (dữ liệu chỉ là mô phỏng). `leads` giữ, đổi tên cột `listing_code` nếu có sang `home_code` hoặc để nguyên tên cũ và ghi chú.

### 5.2 Bảng mới

| Bảng | Dùng cho |
|---|---|
| `buildings` | Toà / dự án: tên, toạ độ, năm bàn giao, tiện ích nội khu (danh sách), phí dịch vụ |
| `pois_manual` | Tiện ích nhập tay hoặc sửa từ OSM: nhóm, tên, toạ độ, `verified`, ghi chú. Gộp với `pois.json` khi chấm điểm |

### 5.3 Dữ liệu mẫu

- `api/data/homes.csv`: 30 căn mô phỏng ở Ocean Park 1, trộn căn hộ (studio đến 3 phòng ngủ, các toà khác nhau) và nhà đất (liền kề, biệt thự), cả bán và thuê. Toạ độ rải để có căn rất gần trường, căn gần hồ, căn xa xe buýt, giúp so sánh thấy rõ khác biệt.
- `api/data/landmarks.json`: các điểm mốc nơi làm việc (trung tâm quận) để ước lượng thời gian đi làm mà không gửi địa chỉ ra dịch vụ ngoài (`PHUONG_PHAP_CHAM_DIEM.md` mục 5).
- `api/scripts/fetch-osm.mjs`: thêm thẻ ở mục 4, tách `kindergarten` khỏi `school`, tách `marketplace` khỏi `supermarket`, thêm `playground`, `pitch`, `swimming_pool`, `railway=station`; lưu thêm thẻ gốc cần để tách cấp học. Chạy lại, commit `pois.json` mới.

---

## 6. Chấm điểm và 5 Agent

Giữ con số 5 Agent (quy trình, tiến độ 5 đoạn, tư thế Mascot đã gắn theo 5 bước) nhưng đổi việc:

| # | Agent cũ | Agent mới | Việc | Tư thế Mascot |
|---|---|---|---|---|
| 1 | Phân tích nhu cầu | **Hiểu gia đình** | Mua/thuê, loại nhà, ngân sách, số phòng ngủ, thành phần gia đình, nơi làm việc, tiện ích ưu tiên | `03-suy-nghi` |
| 2 | Sàng lọc | **Sàng lọc căn** | Loại căn ngoài ngân sách (bán: vượt 10%; thuê: vượt 20%), thiếu phòng ngủ, sai loại nhà | `05-soi-tin-dang` |
| 3 | Đánh giá vị trí | **Học hành và sức khoẻ** | Trường theo độ tuổi con, y tế theo người lớn tuổi | `18-deo-cap` (mới, mục 9.2) |
| 4 | Phân tích cạnh tranh | **Sinh hoạt và đi lại** | Chợ, siêu thị, công viên, sân chơi, thể thao; xe buýt, thời gian tới nơi làm việc | `19-xach-gio` (mới, mục 9.2) |
| 5 | Chấm điểm và khuyến nghị | **Chấm điểm sống và khuyến nghị** | Gộp điểm theo trọng số hồ sơ gia đình, Top 3, ưu điểm, điều cần kiểm chứng | `08-bieu-do` |

### Công thức đề xuất (trọng số mặc định, đổi theo hồ sơ gia đình ở mục 1)

| Thành phần | Trọng số mặc định |
|---|---|
| Ngân sách | 20% |
| Căn phù hợp (diện tích, phòng ngủ, tầng, pháp lý) | 15% |
| Giáo dục | 20% |
| Mua sắm hằng ngày + y tế | 20% |
| Xanh, vui chơi, thể thao | 10% |
| Đi lại | 15% |

Điểm mỗi nhóm tính từ **tiện ích gần nhất** (càng gần càng cao, giảm dần tới hết bán kính) cộng **độ phong phú** (có lựa chọn thứ hai, thứ ba). Vẫn tính hoàn toàn bằng code, không dùng mô hình ngôn ngữ, để cùng tiêu chí luôn ra cùng kết quả.

Công thức đầy đủ (ngưỡng từng loại, hệ số theo gia đình, ngân sách, căn phù hợp, sàng lọc, mẫu câu ưu điểm và "Một ngày của gia đình"): **`docs/PHUONG_PHAP_CHAM_DIEM.md`**.

### File cần sửa

| File | Việc |
|---|---|
| `api/engine.mjs` | `parseCriteria` (tiêu chí mới), `surroundings` (theo nhóm mục 4, có phút đi bộ), `assess` (công thức mới), `recommend`, `card`; bỏ `COMP_KINDS`, `competitors` |
| `api/report.mjs` | `ASK`: câu hỏi và lựa chọn mới; bỏ `traffic()` (lưu lượng khách), thay bằng `dayPlan()`: lộ trình một ngày (7h đưa con đi học, 17h đi chợ, 18h công viên) từ tiện ích gần nhất |
| `api/intake.mjs` | `KEYS`, `STEPS`, `RULES` cho tiêu chí gia đình; chỉ nhận nhu cầu tìm nhà để ở |
| `api/prompt.mjs` | Vai trò, phạm vi, `CRITERIA_LABELS`, thẻ `<mat_bang>` → `<can_nha>`; thêm điều cấm (mục 7) |
| `api/db.mjs`, `api/admin.mjs` | Schema, `TYPES`, bỏ `MODELS`, nhập/xuất CSV mới, API tiện ích nhập tay |
| `api/leads.mjs`, `api/server.mjs` | Tên trường, nội dung tin Telegram ("Đặt lịch xem nhà"), xử lý link chia sẻ cũ |

### 5 câu hỏi của Trợ lý

| Khoá | Câu hỏi | Lựa chọn nhanh |
|---|---|---|
| `home` | Anh/chị muốn mua hay thuê, chung cư hay nhà đất? | Mua căn hộ · Thuê căn hộ · Mua nhà đất · Thuê nhà đất |
| `budget` | Ngân sách khoảng bao nhiêu? | Đổi theo câu 1 (vd: dưới 3 tỷ, 3–5 tỷ… / dưới 10 triệu, 10–20 triệu…) |
| `family` | Nhà mình có mấy người, con mấy tuổi, có ông bà ở cùng không? | Vợ chồng chưa có con · Có con nhỏ dưới 6 tuổi · Có con đi học · Có ông bà ở cùng |
| `area` | Khu vực muốn ở, và bố mẹ đi làm ở đâu? | Ocean Park 1 · Gần hồ · Gần trường · Gõ nơi làm việc |
| `priorities` | Tiện ích nào quan trọng nhất? | Trường gần · Chợ, siêu thị · Công viên · Bệnh viện · Xe buýt |

Số phòng ngủ suy ra từ `family`, hỏi lại chỉ khi không suy ra được.

---

## 7. Quy tắc trợ lý AI (`prompt.mjs`, `intake.mjs`)

Giữ toàn bộ phần chống thao túng, thứ tự ưu tiên, không thu thập thông tin cá nhân. Đổi phạm vi và thêm:

- **Không** cam kết trường đúng tuyến, chất lượng trường, xếp hạng trường.
- **Không** dự báo tăng giá, lợi nhuận đầu tư, tư vấn vay ngân hàng, tư vấn pháp lý (sổ hồng, hợp đồng): chỉ nói "cần kiểm chứng" và nêu việc cần hỏi.
- **Không** đánh giá khu dân cư theo đặc điểm của người sống ở đó (dân tộc, tôn giáo, vùng miền, thu nhập). Chỉ nói về tiện ích và dữ liệu đo được.
- **Không** hỏi tên, ngày sinh của con; chỉ cần nhóm tuổi.
- Nói rõ khoảng cách là ước lượng đường chim bay, dữ liệu OSM có thể thiếu.

---

## 8. Giao diện

### Landing (`design/Main.dc.html`, `index.html`)

| Khối | Nội dung mới |
|---|---|
| Hero | Tiêu đề kiểu "Nhà gần trường, gần chợ, gần công viên. Biết trước khi đi xem." Nút chính: Bắt đầu tư vấn. Ảnh: gia đình / khu dân cư thay ảnh mặt tiền quán |
| Giới thiệu (cuộn ảnh thu nhỏ vào câu) | 4 ảnh: trường, chợ, công viên, căn hộ; câu về "một ngày của gia đình" |
| So sánh | *Cách làm hiện nay* (mở Google Maps đo từng tiện ích, hỏi môi giới) ↔ *Với estateSmartAI* (một bản đồ, mọi tiện ích, phút đi bộ, nguồn) |
| Quy trình 7 bước | Hiểu gia đình → Sàng lọc → Hồ sơ căn → Hệ sinh thái tiện ích → Nhận định AI → So sánh → Đặt lịch xem nhà |
| 5 AI Agent | Theo bảng mục 6 |
| Hồ sơ mẫu | Một căn hộ 2 phòng ngủ mẫu, có vòng 5/10/15 phút đi bộ |
| CTA | Giữ cấu trúc |

`index.html`: `title`, `description`, `keywords` (tìm căn hộ gần trường học, căn hộ cho gia đình, tiện ích quanh chung cư, Vinhomes Ocean Park…), Open Graph, JSON-LD (`SoftwareApplication` → `applicationCategory: LifestyleApplication`, `HowTo` 7 bước mới). Sau đó `public/sitemap.xml`, `scripts/prerender.mjs` nếu có chữ cứng.

### Trợ lý (`src/assistant/Assistant.jsx`, `Hunt.jsx`, `map3d.js`)

- 5 câu hỏi mục 6; tiến độ 5 đoạn giữ nguyên.
- Bản đồ: **vòng 5/10/15 phút đi bộ** quanh căn đang chọn; lớp tiện ích theo nhóm, bật/tắt từng nhóm, mỗi nhóm một biểu tượng; bỏ lớp "đối thủ".
- Báo cáo đầy đủ: bỏ biểu đồ lưu lượng khách theo giờ, thay bằng **"Một ngày của gia đình"** (dòng thời gian, mỗi điểm có phút đi bộ) và **bảng tiện ích theo nhóm**.
- Thẻ kết quả: giá (bán/thuê), số phòng ngủ, diện tích, điểm sống, 3 chip "Trường 6 phút · Chợ 4 phút · Công viên 2 phút".

### Hồ sơ (`design/Listing.dc.html`, chuyển sang `/nha/`)

| Khối cũ | Khối mới |
|---|---|
| Thông số (mặt tiền, lòng đường, đặt cọc) | Thông số căn: phòng ngủ, WC, tầng, hướng, pháp lý, nội thất, phí dịch vụ |
| N không gian, công năng đề xuất | Bố trí căn: từng phòng |
| Khả năng tiếp cận | Đi lại |
| Tiện ích xung quanh | **Hệ sinh thái quanh nhà**: bảng theo nhóm (gần nhất, phút đi bộ, số lượng), bản đồ nhỏ |
| Phân tích cạnh tranh, phân khúc giá | So sánh giá với các căn tương tự trong khu |
| Nhận định AI: ưu điểm / rủi ro | Ưu điểm / **điều cần kiểm chứng** (tuyến trường, pháp lý, tiếng ồn) |
| Đặt lịch khảo sát thực địa | Đặt lịch xem nhà; vai trò: người mua / người thuê |

### Quản trị (`src/entries/Admin.jsx`)

Form và CSV theo cột mới; tab mới **Tiện ích** (thêm, sửa, đánh dấu kiểm chứng, ẩn điểm OSM sai); tab **Toà / dự án**.

---

## 9. Mascot

Hình Mascot (robot đầu là căn nhà, ăng-ten là ghim bản đồ) **hợp với nhà ở hơn cả chủ đề cũ**, nên giữ nguyên nhân vật và bảng màu.
Phần phải đổi là **việc Mascot đang làm**: nhiều câu nói và tư thế đang gắn với "dò đối thủ", "soi tin cho thuê mặt bằng", "dải phân cách", "giá thuê khu vực".

### 9.1 Những chỗ đang gắn với chủ đề cũ

| Chỗ | Hiện tại | Đổi thành |
|---|---|---|
| `src/assistant/Hunt.jsx` trạm 4 | `06-ong-nhom`, "Ngó đối thủ…", nhãn "Cạnh tranh" | `19-xach-gio`, "Tìm chợ, công viên…", nhãn "Sinh hoạt" |
| `src/assistant/Hunt.jsx` các trạm khác | "Đọc nhu cầu…", "Lọc tin đăng…", "Xem vị trí…" | Theo bảng 9.3 |
| `src/entries/Listing.jsx` khối `comp` | `06-ong-nhom`, "Đối thủ quanh đây và khoảng trống còn lại." | Khối `eco` (Hệ sinh thái quanh nhà), `06-ong-nhom`, "Nhìn quanh xem: trường, chợ, công viên cách bao xa." |
| `src/entries/Listing.jsx` các khối khác | "điểm phù hợp của mặt bằng", "công năng" từng không gian, "Lối vào, chỗ đỗ xe" | Theo bảng 9.4 |
| `design/Main.dc.html` `#gioi-thieu` | "Mình gom tin cho thuê, giao thông và **đối thủ trên GrabFood, ShopeeFood**…" | "Mình gom tin rao, trường, chợ, công viên quanh từng căn về một chỗ." |
| `design/Main.dc.html` khối so sánh | "Thay vì 1–2 tuần dò tin, bạn nhận ngay 3 mặt bằng đáng đi xem…" | "Thay vì tự đo từng chỗ trên bản đồ, bạn nhận 3 căn đáng đi xem, kèm phút đi bộ tới mọi tiện ích." |
| `design/Main.dc.html` `chapterData` (7 bước) | Bước "Đánh giá vị trí": "lối vào, **dải phân cách** và chỗ đỗ xe"; "Hồ sơ mặt bằng" | Theo bảng 9.5 |
| `design/Main.dc.html` `studyData` (hồ sơ mẫu) | "Thẩm định vị trí, khả năng tiếp cận và giá thuê"; "Ba mặt bằng phù hợp nhất" | "Điểm sống, hệ sinh thái quanh nhà và giá"; "Ba căn hợp nhất với gia đình bạn" |
| `src/mascot/useMascot.js` `REACTIONS` | "Tìm mặt bằng không?" | "Tìm nhà cho cả nhà nhé?" |
| `src/assistant/Assistant.jsx` câu chờ | "Gõ nhu cầu bên trái, mình đi tìm ngay!" | "Kể mình nghe nhà mình cần gì nhé!" (câu khi đã gõ giữ nguyên) |
| `src/entries/MascotLab.jsx` | Chuỗi thử "Soi tin đăng…", "Ngó đối thủ…" | Chép đúng chuỗi mới của `Hunt.jsx` |
| `design/mascot/index.html` | "Trợ lý đi khảo sát mặt bằng", "Tìm mặt bằng không?", "Soi đối thủ quanh đây…", "Đang đi tìm mặt bằng…" | Câu mới tương ứng |
| `design/mascot/gen_mascot.py` (cột "dùng cho" của từng tư thế, sinh ra `META` trong `poses.js`) | `05`: "mô tả đẹp, thực tế sao?"; `06`: "**Đối thủ cùng ngành, nguồn khách**"; `07`: "mặt tiền, chỗ để xe"; `08`: "Giá thuê khu vực"; `09`: "bán kính 300 m"; `13`: "gửi yêu cầu khảo sát" | `05`: "Soi tin rao, ảnh đẹp thực tế sao?"; `06`: "Nhìn quanh tìm tiện ích"; `07`: "Diện tích căn, phút đi bộ"; `08`: "Điểm sống"; `09`: "Vòng 15 phút đi bộ"; `13`: "Đặt lịch xem nhà xong" |
| `docs/KE_HOACH_MASCOT.md` | "chuyên đi khảo sát mặt bằng"; bảng mục 2, mục 4 theo Agent cũ | Mục 9.6 |

Kiểm tra cuối: `grep -rniE "đối thủ|cạnh tranh|mặt bằng|tin đăng|GrabFood|ShopeeFood" src design docs` không còn kết quả nào trong phần Mascot.

### 9.2 Tư thế: dùng lại và vẽ thêm

**Dùng lại, chỉ đổi ý nghĩa** (không vẽ lại): `06-ong-nhom` trước là "ngó đối thủ", nay là "nhìn quanh tìm tiện ích". Hình ống nhòm trung tính nên dùng được ngay.
Các tư thế còn lại (`00`–`17`, avatar) giữ nguyên hình.

**Vẽ thêm 5 tư thế** để Mascot kể được "một ngày của gia đình", mỗi tư thế ứng với một nhóm tiện ích:

| File mới | Tư thế | Nhóm tiện ích | Dùng ở |
|---|---|---|---|
| `18-deo-cap` | Đeo cặp sách, tay cầm sách | Giáo dục | Agent 3, dòng "Trường" trong hồ sơ, bước 7h trong "Một ngày" |
| `19-xach-gio` | Xách giỏ đi chợ, rau thò ra | Mua sắm hằng ngày | Agent 4, dòng "Chợ, siêu thị" |
| `20-hop-y-te` | Ôm hộp có dấu chữ thập | Y tế | Dòng "Y tế", hồ sơ có ông bà |
| `21-xich-du` | Ngồi xích đu đung đưa | Xanh và vui chơi | Dòng "Công viên", bước chiều trong "Một ngày" |
| `22-cho-xe-buyt` | Đứng cạnh biển xe buýt, nhìn đồng hồ | Đi lại | Dòng "Đi lại" |

Cách làm theo đúng quy trình ở `docs/KE_HOACH_MASCOT.md` mục 1: vẽ trong `design/mascot/gen_mascot.py` (dùng lại bộ phận chung `hd`, `bd`, `lg`, `ARM`, `HAND`), chạy lại để sinh cả hai bảng màu `goc/` và `thuong-hieu/`, `poses.js`, rồi chép sang `public/mascot/`.
Mỗi tư thế: một hoạt ảnh CSS nhỏ (đung đưa, nảy), tự đứng yên khi bật giảm chuyển động, dưới 6 KB.

Chưa vẽ xong thì dùng tạm: `18` → `07-do-dac`, `19` → `06-ong-nhom`, `20`/`22` → `09-ban-do`, `21` → `13-an-mung`. Nhờ vậy phần đổi chữ (9.3–9.5) làm được trước, không phải chờ hình.

### 9.3 Trợ lý: Mascot chạy theo 5 Agent mới (`Hunt.jsx`)

| Trạm | Agent | Tư thế | Câu nói | Nhãn |
|---|---|---|---|---|
| 1 | Hiểu gia đình | `03-suy-nghi` | Nghe nhà mình cần gì… | Gia đình |
| 2 | Sàng lọc căn | `05-soi-tin-dang` | Lọc tin rao… | Sàng lọc |
| 3 | Học hành và sức khoẻ | `18-deo-cap` | Đo đường tới trường… | Trường, y tế |
| 4 | Sinh hoạt và đi lại | `19-xach-gio` | Tìm chợ, công viên… | Sinh hoạt |
| 5 | Chấm điểm sống | `08-bieu-do` | Chấm điểm sống… | Chấm điểm |

Kết thúc vẫn là `04-tim-thay` ("Tìm thấy rồi!"), lỗi vẫn `12-boi-roi`.
Dải phố mờ phía sau (5 trạm) đổi hình nền thành khu dân cư: toà chung cư, trường, chợ, cây công viên, biển xe buýt, mỗi trạm đứng trước công trình của nhóm mình.

Bảng Agent ở mục 6 đổi cột "Tư thế Mascot" theo bảng này.

### 9.4 Hồ sơ căn nhà (`Listing.jsx`, Mascot nhảy theo section)

| Khối | Tư thế | Câu nói |
|---|---|---|
| `hero` | `04-tim-thay` | Đây là điểm sống của căn này. |
| `specs` | `07-do-dac` | Phòng ngủ, diện tích, pháp lý, xem giá trước nhé. |
| `rooms` | `05-soi-tin-dang` | Bấm từng phòng để xem bố trí. |
| `location` | `09-ban-do` | Vòng 15 phút đi bộ quanh nhà đây. |
| `eco` (thay `comp`) | `06-ong-nhom` | Trường, chợ, công viên cách bao xa, xem ở đây. |
| `verdict` | `08-bieu-do` | Ưu điểm, và vài điều nên tự kiểm chứng. |
| `contact` | `10-ngon-cai` | Ưng rồi thì đặt lịch đi xem nhé! |

Trong bảng tiện ích của hồ sơ, mỗi nhóm có biểu tượng nhỏ là đầu Mascot với đạo cụ của nhóm (cặp, giỏ, hộp y tế, xích đu, biển xe buýt), cắt từ 5 tư thế mới.

### 9.5 Landing (`design/Main.dc.html`)

| Bước (`chapterData`) | Tư thế | Câu nói |
|---|---|---|
| Hiểu gia đình | `03-suy-nghi` | Bạn kể nhà mình mấy người, con mấy tuổi, ngân sách bao nhiêu. |
| Sàng lọc | `05-soi-tin-dang` | Mình loại căn vượt ngân sách hoặc thiếu phòng, phần còn lại ghim lên bản đồ. |
| Hồ sơ căn | `07-do-dac` | Mỗi căn có ảnh, thông số và nguồn để bạn tự kiểm tra. |
| Hệ sinh thái tiện ích | `09-ban-do` | Mình đo đường tới trường, chợ, công viên bằng phút đi bộ. |
| Nhận định AI | `08-bieu-do` | Chấm điểm sống 0–100, nói rõ điểm mạnh và điều cần kiểm chứng. |
| So sánh | `06-ong-nhom` | Ba căn đặt cạnh nhau theo cùng tiêu chí, chọn dễ hơn hẳn. |
| Đặt lịch xem nhà | `04-tim-thay` | Ưng căn nào, mình gửi lời nhắn và hẹn lịch xem giúp bạn. |

Hero giữ `01-chao` ("Chào bạn!"), CTA cuối giữ `10-ngon-cai`. Khối 5 Agent đổi hình `07-do-dac` thành chuỗi 5 đầu Mascot nhỏ cầm đạo cụ của từng Agent (khi đã có tư thế mới).

### 9.6 Giọng nói của Mascot

- Nói với cả nhà: "bạn", "nhà mình", "cả nhà". Không dùng từ kinh doanh: khách, doanh thu, đối thủ, nguồn khách, mặt tiền.
- Bong bóng tối đa khoảng 12 chữ (bước quy trình có thể dài hơn vì nằm trong khối chữ).
- Không hứa thay hệ thống: không nói "đúng tuyến", "trường tốt", "an ninh", "sẽ tăng giá".
- Không nhắc tên hay tuổi cụ thể của con người dùng, kể cả khi họ đã gõ vào chat.
- Danh sách câu nói gom về một chỗ để nhóm duyệt một lần (như yêu cầu ở `KE_HOACH_MASCOT.md` mục 8).

### 9.7 Cập nhật `docs/KE_HOACH_MASCOT.md`

- Câu mở đầu: "chuyên đi dò tiện ích quanh nhà cho cả gia đình".
- Mục 1: thêm 5 file tư thế mới.
- Mục 2: bảng tư thế, cột "Dùng ở đâu" theo 9.2–9.5; thêm 5 dòng mới.
- Mục 4: bảng landing, Trợ lý, hồ sơ theo 9.3–9.5; đổi `/mat-bang/` thành `/nha/`.
- Mục 7, giai đoạn 6 (tuỳ chọn): Mascot đi bộ trên bản đồ MapLibre **từ căn nhà tới từng tiện ích**, có bộ đếm phút. Ý tưởng này giờ khớp chủ đề hơn trước, nên nâng lên thành việc nên làm sau khi có vòng đi bộ.

---

## 10. Thứ tự làm

| Giai đoạn | Việc | Xong khi |
|---|---|---|
| 1. Chốt và docs | Trả lời mục 0; cập nhật tài liệu này; viết `PHUONG_PHAP_CHAM_DIEM.md`; sửa `README.md` | Docs mô tả đúng sản phẩm mới, chưa động code — **xong** |
| 2. Dữ liệu | `fetch-osm.mjs` + `pois.json` mới; schema `homes`, `buildings`, `pois_manual`; `homes.csv` 30 căn | `npm run dev` trong `api/` tạo DB mới, `/api/health` ổn — **xong** |
| 3. Chấm điểm và API | `engine.mjs`, `report.mjs`, `intake.mjs`, `prompt.mjs`, `leads.mjs`, `server.mjs` | Gọi API với 3 hồ sơ gia đình khác nhau ra Top 3 khác nhau, giải thích được — **xong**; API vẫn trả thêm các trường tên cũ để giao diện hiện tại chạy tạm, bỏ ở giai đoạn 4 |
| 4. Trợ lý | Câu hỏi, bản đồ vòng đi bộ, lớp tiện ích, báo cáo "một ngày" | Đi hết luồng trên 390px và 1440px |
| 5. Hồ sơ và quản trị | `Listing.dc.html` → `/nha/`, chuyển hướng `/mat-bang/`; Admin cột mới, tab Tiện ích | Thêm một căn và một tiện ích từ quản trị, thấy ngay trên hồ sơ |
| 6. Landing và SEO | `Main.dc.html`, `index.html`, sitemap, ảnh mới | Không còn chữ "mặt bằng", "F&B", "quán" ngoài ngữ cảnh ăn uống |
| 7. Mascot: chữ | Câu nói và nhãn ở mục 9.1, 9.3–9.5 (dùng tư thế tạm); `gen_mascot.py` phần mô tả; `KE_HOACH_MASCOT.md` | Không còn "đối thủ", "tin đăng", "mặt bằng" trong lời Mascot — **xong** trên nhánh `feat/nha-o-gia-dinh` |
| 8. Mascot: hình mới | 5 tư thế mục 9.2, nền khu dân cư cho `Hunt.jsx`, biểu tượng nhóm tiện ích | Thay hết tư thế tạm; xem ở `/thu-mascot/` cả hai bảng màu, giảm chuyển động |
| 9. Kiểm tra | `grep -ri "mặt bằng\|F&B\|đối thủ\|cạnh tranh\|tin đăng"` toàn repo; luồng đầy đủ; in PDF; Telegram; link chia sẻ cũ | Sạch, không lỗi console |

Giai đoạn 2–3 nên làm trên nhánh riêng (`feat/nha-o-gia-dinh`) vì webhook chỉ deploy `main`; gộp vào `main` khi giai đoạn 6 xong để trang thật không lẫn hai chủ đề.

---

## 11. Rủi ro

| Rủi ro | Cách xử lý |
|---|---|
| OSM thiếu chợ, trường tư, nhà thuốc → điểm sai | Tab Tiện ích nhập tay; hiện "theo OSM, có thể thiếu"; ưu tiên kiểm chứng tay các điểm quanh 30 căn mẫu |
| Người dùng hiểu "gần trường" là "đúng tuyến" | Nhắc ở hồ sơ, prompt và bảng tiện ích |
| Đường chim bay lệch xa thực tế (qua sông, qua đại lộ không có lối sang) | Hệ số 1,3; giai đoạn sau dùng định tuyến đi bộ (tự cài OSRM / Valhalla, không dùng máy chủ demo công cộng) |
| Dữ liệu căn là mô phỏng | Giữ nhãn "dữ liệu mô phỏng" như hiện nay |
| SEO cũ ("thẩm định mặt bằng") mất | Chấp nhận; chuyển hướng 301 giữ link, sitemap mới |
