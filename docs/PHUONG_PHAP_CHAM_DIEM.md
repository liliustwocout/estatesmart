# Phương pháp chấm điểm sống

Tài liệu này mô tả cách estateSmartAI chấm một căn nhà cho một gia đình cụ thể: đo khoảng cách tới tiện ích, tính điểm từng nhóm, đổi trọng số theo gia đình, rồi gộp thành **điểm sống 0–100**.
Đây là đặc tả để viết lại `api/engine.mjs` (giai đoạn 3 trong `docs/KE_HOACH_DOI_CHU_DE.md`); khi code xong, tài liệu này mô tả đúng code.

Nguyên tắc giữ từ bản cũ:
- **Tính bằng code, không dùng mô hình ngôn ngữ.** Cùng tiêu chí, cùng dữ liệu thì luôn ra cùng điểm. Mô hình ngôn ngữ chỉ đọc câu người dùng gõ (Agent 1) và giải thích kết quả.
- **Mỗi con số có nguồn:** tên tiện ích, khoảng cách, nguồn dữ liệu (OpenStreetMap, nhập tay đã kiểm chứng, dữ liệu mô phỏng).
- **Nói rõ cái không biết:** khoảng cách là ước lượng; dữ liệu tiện ích có thể thiếu; trường gần không có nghĩa là đúng tuyến.

---

## 1. Đo khoảng cách và thời gian

| Đại lượng | Cách tính | Ghi chú |
|---|---|---|
| Khoảng cách thẳng `d` | Công thức haversine giữa toạ độ căn và toạ độ tiện ích (hàm `distance` hiện có) | Mét |
| Quãng đường ước lượng | `d × 1,3` | Hệ số vòng vèo của đường đi bộ trong khu đô thị |
| Phút đi bộ `t` | `d × 1,3 / 80`, làm tròn lên | 80 m/phút ≈ 4,8 km/h, nhịp đi bộ thong thả có trẻ con |
| Phút đi xe tới nơi làm việc | `d × 1,4 / 400`, làm tròn tới 5 phút | 400 m/phút ≈ 24 km/h trung bình giờ cao điểm nội đô; chỉ dùng cho điểm mốc ở mục 5 |

Giao diện luôn ghi "khoảng N phút đi bộ" và chú thích "ước lượng theo đường chim bay". Khi có định tuyến đi bộ thật (tự cài OSRM hoặc Valhalla), chỉ cần thay hàm tính `t`; phần chấm điểm giữ nguyên.

---

## 2. Loại tiện ích và ngưỡng

Mỗi loại tiện ích có hai ngưỡng: **`tốt`** (gần tới mức này là đủ điểm) và **`xa`** (từ mức này trở đi coi như không có).

| Nhóm | Loại | `tốt` | `xa` | Nguồn |
|---|---|---|---|---|
| Giáo dục | Mầm non | 5 phút | 15 phút | OSM `amenity=kindergarten`, hoặc `school` có tên chứa "Mầm non", "Mẫu giáo" |
| | Tiểu học | 7 phút | 20 phút | `amenity=school`, tên chứa "Tiểu học" hoặc "Liên cấp" |
| | THCS | 10 phút | 25 phút | tên chứa "THCS", "Trung học cơ sở" hoặc "Liên cấp" |
| | THPT | 15 phút | 35 phút | tên chứa "THPT", "Trung học phổ thông" hoặc "Liên cấp" |
| Mua sắm hằng ngày | Chợ | 5 phút | 15 phút | `amenity=marketplace` |
| | Siêu thị | 7 phút | 20 phút | `shop=supermarket` |
| | Cửa hàng tiện lợi | 3 phút | 10 phút | `shop=convenience` |
| | Trung tâm thương mại | 10 phút | 30 phút | `shop=mall/department_store` |
| Y tế | Nhà thuốc | 3 phút | 10 phút | `amenity=pharmacy` |
| | Phòng khám | 7 phút | 20 phút | `amenity=clinic/doctors` |
| | Bệnh viện | 2 km | 8 km | `amenity=hospital`; đo bằng **km đường chim bay** vì thường đi xe |
| Xanh và vui chơi | Công viên, vườn hoa, hồ | 3 phút | 12 phút | `leisure=park/garden`, `natural=water` có tên |
| | Sân chơi trẻ em | 3 phút | 10 phút | `leisure=playground` |
| Thể thao | Bể bơi, gym, sân thể thao | 7 phút | 20 phút | `leisure=swimming_pool/fitness_centre/sports_centre/pitch` |
| Đi lại | Điểm xe buýt | 3 phút | 10 phút | `highway=bus_stop` |
| | Ga metro | 10 phút | 25 phút | `railway=station` + `station=subway` hoặc tuyến đường sắt đô thị |

Trường không xác định được cấp học từ tên → tính là **"Trường (chưa rõ cấp)"**, được dùng cho mọi cấp nhưng chỉ ăn **70%** điểm, và hồ sơ ghi "chưa rõ cấp học".

Tiện ích **nội khu** (bể bơi, gym, sân chơi trong toà, nhập ở bảng `buildings`) tính `t = 1 phút` cho mọi căn thuộc toà đó, ghi nguồn "tiện ích nội khu (chủ đầu tư công bố)".

Tiện ích nhập tay ở bảng `pois_manual` có `verified = 1` được ưu tiên; điểm OSM bị quản trị viên đánh dấu ẩn thì bỏ qua.

Hai quy tắc về dữ liệu thiếu:
- **Loại tiện ích không có điểm nào trong toàn bộ dữ liệu thì không tính** (bỏ khỏi trung bình của nhóm), thay vì cho mọi căn 0 điểm. Kết quả ghi rõ "Dữ liệu chưa có … trong khu". Ảnh chụp OSM 17/11/2026 không có nhà thuốc nào, nên nhà thuốc chưa được tính cho tới khi quản trị viên nhập tay.
- **Ga metro chỉ tính khi nhập tay và đã kiểm chứng.** OSM có các ga đường sắt đô thị quy hoạch, chưa vận hành; tính chúng sẽ làm người dùng tưởng có metro.

Tiện ích nội khu `vuon` (vườn trong khuôn viên) được tính như công viên; `be_boi`, `gym` như thể thao; `san_choi`, `mam_non`, `tien_loi` như loại cùng tên.

---

## 3. Điểm một loại tiện ích

### 3.1 Điểm gần

Với tiện ích gần nhất cùng loại, thời gian `t`:

```
gần(t) = 100                               nếu t ≤ tốt
       = 100 × (xa − t) / (xa − tốt)       nếu tốt < t < xa
       = 0                                 nếu t ≥ xa hoặc không có
```

Ví dụ: chợ cách 9 phút → `100 × (15 − 9) / (15 − 5) = 60`.

### 3.2 Thưởng lựa chọn

Có thêm lựa chọn thứ hai, thứ ba cùng loại trong ngưỡng `xa` thì gia đình bớt phụ thuộc vào một nơi:
**+8 điểm mỗi lựa chọn thêm, tối đa +16**, không vượt 100.

```
điểm_loại = min(100, gần(t₁) + 8 × min(2, số tiện ích khác cùng loại có t < xa))
```

Thưởng chỉ áp dụng khi `gần(t₁) > 0`, để ba tiện ích đều xa không cộng thành điểm cao.

---

## 4. Điểm một nhóm

Điểm nhóm = **trung bình có trọng số** của điểm các loại trong nhóm. Trọng số loại phụ thuộc gia đình:

| Nhóm | Loại và trọng số mặc định | Đổi theo gia đình |
|---|---|---|
| Giáo dục | Mầm non 1, Tiểu học 1, THCS 1, THPT 1 | Chỉ tính các cấp ứng với tuổi con: dưới 6 tuổi → Mầm non 3, Tiểu học 1 (sắp vào lớp 1); 6–10 → Tiểu học 3, THCS 1; 11–14 → THCS 3, THPT 1; 15–18 → THPT 3. Nhiều con thì cộng dồn |
| Mua sắm hằng ngày | Chợ 3, Siêu thị 3, Tiện lợi 2, TTTM 1 | Có ông bà: Chợ 4 |
| Y tế | Nhà thuốc 2, Phòng khám 2, Bệnh viện 1 | Có ông bà: Bệnh viện 3; con dưới 6 tuổi: Phòng khám 3 |
| Xanh và vui chơi | Công viên 2, Sân chơi 1 | Con dưới 11 tuổi: Sân chơi 3 |
| Thể thao | Mỗi loại 1 | — |
| Đi lại | Xe buýt 2, Metro 1, Đi làm (mục 5) 2 | Không có nơi làm việc → bỏ phần Đi làm |

Gia đình **chưa có con**: nhóm Giáo dục vẫn tính (cho bán lại, cho tương lai) nhưng trọng số nhóm giảm ở mục 6.

---

## 5. Thời gian đi làm

Người dùng chọn hoặc gõ nơi làm việc. Bản đầu **không geocode địa chỉ tự do** (tránh gửi địa chỉ ra dịch vụ ngoài): trợ lý quy câu trả lời về một trong các điểm mốc có toạ độ gần đúng của trung tâm quận, lưu trong `api/data/landmarks.json`.

| Điểm mốc | Ví dụ câu người dùng |
|---|---|
| Hoàn Kiếm | "làm ở phố cổ", "Hồ Gươm" |
| Ba Đình | "Kim Mã", "Liễu Giai" |
| Cầu Giấy | "Duy Tân", "Trần Duy Hưng" |
| Thanh Xuân | "Royal City", "Nguyễn Trãi" |
| Hai Bà Trưng | "Times City", "Bạch Mai" |
| Long Biên | "Aeon Long Biên", "Ngọc Lâm" |
| Gia Lâm | "Trâu Quỳ", "trong Ocean Park" |
| Nam Từ Liêm | "Mỹ Đình", "Keangnam" |

Không khớp điểm mốc nào → bỏ phần Đi làm, hồ sơ ghi "chưa tính thời gian đi làm".

Điểm Đi làm theo **phút đi xe** `T` (mục 1): `100` nếu `T ≤ 20`, giảm tuyến tính về `0` ở `T = 60`. Hai người đi làm hai nơi thì lấy trung bình.

---

## 6. Điểm sống

### 6.1 Sáu thành phần

| Thành phần | Trọng số mặc định | Cách tính |
|---|---|---|
| Ngân sách | 20 | Mục 6.3 |
| Căn phù hợp | 15 | Mục 6.4 |
| Giáo dục | 20 | Mục 4 |
| Hằng ngày | 20 | Trung bình nhóm Mua sắm (trọng số 3) và Y tế (trọng số 2) |
| Xanh, vui chơi, thể thao | 10 | Trung bình nhóm Xanh (2) và Thể thao (1) |
| Đi lại | 15 | Mục 4, 5 |

### 6.2 Đổi trọng số theo gia đình

Nhân trọng số mặc định với các hệ số sau (nhiều dòng cùng đúng thì nhân dồn), rồi **chia lại cho tổng = 100**:

| Điều kiện | Hệ số |
|---|---|
| Chưa có con | Giáo dục × 0,25 |
| Con dưới 11 tuổi | Xanh, vui chơi, thể thao × 1,5 |
| Có ông bà ở cùng | Hằng ngày × 1,3; Xanh, vui chơi, thể thao × 1,3 |
| Có nơi làm việc ngoài Gia Lâm | Đi lại × 1,5 |
| Người dùng chọn một nhóm là **ưu tiên** (câu hỏi 5) | Nhóm đó × 1,5 (tối đa hai nhóm) |

Ví dụ: vợ chồng có một con 4 tuổi, làm ở Cầu Giấy, ưu tiên "Trường gần".
Giáo dục `20 × 1,5 = 30` (ưu tiên); Xanh `10 × 1,5 = 15` (con dưới 11 tuổi); Đi lại `15 × 1,5 = 22,5` (làm ở Cầu Giấy); còn lại giữ nguyên.
Tổng `20 + 15 + 30 + 20 + 15 + 22,5 = 122,5` → chia lại cho 1,225: Ngân sách 16,3; Căn 12,2; Giáo dục 24,5; Hằng ngày 16,3; Xanh 12,2; Đi lại 18,4.

Trọng số sau cùng hiện trong báo cáo đầy đủ, làm tròn số nguyên ("Vì nhà bạn có con nhỏ và chọn ưu tiên trường gần, trường học chiếm khoảng 24% điểm"), để người dùng hiểu vì sao hai gia đình thấy hai thứ hạng khác nhau.

### 6.3 Ngân sách

Ngân sách quy về một khoảng `[thấp, cao]` (giá bán: tỷ; giá thuê: triệu/tháng).

| Trường hợp | Điểm |
|---|---|
| Giá trong khoảng | 100 |
| Giá dưới `thấp` | 90 (rẻ hơn dự kiến, có thể kém hơn mong đợi) |
| Mua, vượt `cao` x% | `100 − 8x`, **loại ở bước sàng lọc** nếu x > 10 |
| Thuê, vượt `cao` x% | `100 − 4x`, **loại ở bước sàng lọc** nếu x > 20 |
| Không nêu ngân sách | 70 |

Giá bán dùng `price_billion`, giá thuê dùng `rent_million`; căn chỉ có giá bán thì không vào kết quả của người tìm thuê và ngược lại.

### 6.4 Căn phù hợp

Bắt đầu 100, trừ dần, tối thiểu 0:

| Điều kiện | Trừ |
|---|---|
| Thiếu 1 phòng ngủ so với nhu cầu | 40 (thiếu từ 2 phòng → **loại** ở sàng lọc) |
| Thừa từ 2 phòng ngủ | 10 (đắt hơn mức cần) |
| Diện tích lệch khoảng mong muốn | `250 × tỷ lệ lệch`, như bản cũ |
| Mua, pháp lý "đang chờ sổ" | 10 |
| Mua, pháp lý "HĐMB" (chưa có sổ, chưa rõ thời hạn) | 15 |
| Có người lớn tuổi, căn tầng cao mà toà không có thang máy | 30 |
| Gia đình có ô tô, căn không có chỗ đỗ (`car_parking = khong`) | 20 |

Số phòng ngủ cần, khi người dùng không nói thẳng: vợ chồng chưa con → 1; một con → 2; hai con, hoặc một con và ông bà → 3; đông hơn → 4.

Câu trả lời về gia đình không nhắc tới con (và không nói rõ "chưa có con", "chỉ hai vợ chồng") thì coi là **chưa rõ có con hay không**: không giảm trọng số Giáo dục, không suy ra số phòng ngủ (trừ khi có ông bà ở cùng → 2).

### 6.5 Gộp và xếp hạng

```
điểm_sống = round( Σ trọng_số_thành_phần × điểm_thành_phần / 100 )
```

Xếp giảm dần theo điểm sống; bằng điểm thì giá thấp hơn đứng trước, rồi đến mã căn (để thứ tự luôn cố định).

---

## 7. Sàng lọc (Agent 2)

1. Chỉ lấy căn đúng **hình thức** (mua / thuê) và đúng **nhóm loại nhà** (chung cư: `can_ho`, `studio`, `duplex`, `penthouse`; nhà đất: `nha_pho`, `lien_ke`, `biet_thu`). Người dùng không nói nhóm loại thì lấy cả hai.
2. Loại căn vượt ngân sách quá ngưỡng (mục 6.3) và căn thiếu từ 2 phòng ngủ.
3. Còn dưới 3 căn → nới lần lượt: bỏ điều kiện phòng ngủ, rồi nới ngân sách thêm 10%, rồi bỏ điều kiện nhóm loại nhà. Mỗi lần nới ghi một câu vào `notes` để giao diện báo người dùng.

---

## 8. Ưu điểm và điều cần kiểm chứng

Sinh bằng mẫu câu từ dữ liệu, tối đa 3 câu mỗi bên, ưu tiên theo trọng số thành phần của gia đình đó.

| Loại | Mẫu câu | Khi nào |
|---|---|---|
| Ưu điểm | "Trường mầm non {tên} khoảng {t} phút đi bộ." | Điểm loại ≥ 80 và loại đó có trọng số |
| Ưu điểm | "Có {n} lựa chọn đi chợ, siêu thị trong 10 phút." | n ≥ 3 |
| Ưu điểm | "Công viên {tên} ngay cạnh, khoảng {t} phút." | t ≤ 3 |
| Cần kiểm chứng | "Trường gần nhất không chắc đúng tuyến; hỏi phường {zone} về địa bàn tuyển sinh." | Gia đình có con trong tuổi công lập và có trường trong 15 phút |
| Cần kiểm chứng | "Chưa ghi nhận chợ trong 15 phút theo dữ liệu hiện có; nên đi một vòng quanh khu." | Không có chợ |
| Cần kiểm chứng | "Pháp lý đang là {legal}; kiểm tra tiến độ cấp sổ với chủ đầu tư." | Mua, chưa có sổ |
| Cần kiểm chứng | "Đi làm ước khoảng {T} phút; thử đi đúng giờ cao điểm trước khi quyết." | T > 40 |

Không sinh câu đánh giá chất lượng trường, mức an ninh hay "dân trí" của khu.

---

## 9. "Một ngày của gia đình"

Thay biểu đồ lưu lượng khách cũ (`traffic()` trong `api/report.mjs`). Dựng từ tiện ích gần nhất của các loại có trọng số, theo khung giờ cố định:

| Giờ | Việc | Tiện ích | Khi nào có |
|---|---|---|---|
| 7:00 | Đưa con đi học | Trường đúng cấp gần nhất | Có con trong tuổi đi học |
| 7:30 | Đi làm | Điểm mốc nơi làm việc (phút đi xe) hoặc điểm xe buýt | Có nơi làm việc |
| 9:00 | Ông bà đi chợ | Chợ gần nhất | Có ông bà |
| 17:30 | Ghé siêu thị | Siêu thị hoặc tiện lợi gần nhất | Luôn |
| 18:30 | Cho con ra công viên | Sân chơi hoặc công viên gần nhất | Có con dưới 11 tuổi |
| 20:00 | Mua thuốc | Nhà thuốc gần nhất | Luôn |

Mỗi dòng: giờ, việc, tên tiện ích, phút đi bộ, đường đi vẽ trên bản đồ (đường thẳng nét đứt cho tới khi có định tuyến).

---

## 10. Giới hạn cần nói với người dùng

- Khoảng cách và thời gian là **ước lượng** từ đường chim bay.
- Dữ liệu tiện ích lấy từ OpenStreetMap (ngày lấy ghi ở `pois.json`) và nhập tay; có thể **thiếu** chợ dân sinh, trường tư, nhà thuốc nhỏ.
- **Trường gần không có nghĩa là đúng tuyến.** Trường công lập ở Hà Nội tuyển sinh theo địa bàn; gia đình cần hỏi phường.
- Dữ liệu căn hiện là **mô phỏng**.
- Điểm sống phản ánh mức thuận tiện về tiện ích cho gia đình đã mô tả, **không** phải định giá, không dự báo tăng giá, không đánh giá pháp lý.
