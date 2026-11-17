# estateSmartAI — Web

Landing page và bản mô phỏng MVP (trợ lý AI, hồ sơ căn nhà) của dự án T020 — AI In Action.

estateSmartAI giúp **gia đình** tìm căn hộ chung cư hoặc nhà đất để ở (mua hoặc thuê), chấm điểm theo **hệ sinh thái tiện ích quanh nhà**: trường học theo tuổi con, chợ và siêu thị, y tế, công viên và sân chơi, đi lại. Mỗi tiện ích có khoảng cách, thời gian đi bộ ước lượng và nguồn.

> **Đang chuyển chủ đề** từ thẩm định mặt bằng kinh doanh sang nhà ở cho gia đình, trên nhánh `feat/nha-o-gia-dinh`. API đã theo chủ đề mới; giao diện các trang và đường dẫn bên dưới vẫn theo chủ đề cũ cho tới khi xong.
> Kế hoạch: [docs/KE_HOACH_DOI_CHU_DE.md](docs/KE_HOACH_DOI_CHU_DE.md). Cách chấm điểm: [docs/PHUONG_PHAP_CHAM_DIEM.md](docs/PHUONG_PHAP_CHAM_DIEM.md).

| Đường dẫn | Trang |
|---|---|
| `/` | Landing |
| `/tro-ly/` | Trợ lý AI: chat bên trái, bản đồ 2D / mô hình 3D bên phải |
| `/mat-bang/` | Hồ sơ mặt bằng chi tiết |
| `/quan-tri/` | Quản trị (đăng nhập bằng mật khẩu): mặt bằng (thêm, sửa, ẩn, nhập/xuất CSV) và yêu cầu khảo sát của khách |
| `/api/` | Máy chủ API (`api/`): 5 Agent chấm điểm sống, SQLite, trợ lý AI (DeepSeek) |

## Chạy trên máy

```bash
npm install
npm run dev
```

Trợ lý, bản đồ kết quả và hồ sơ cần thêm máy chủ API. Khoá DeepSeek và `ADMIN_PASSWORD` đặt trong `api/.env` (mẫu ở `api/.env.example`); cơ sở dữ liệu tự tạo ở `api/data/local.db` từ `api/data/homes.csv`, `buildings.csv`, `pois_manual.csv`:

```bash
cd api && npm run dev
```

## Sửa giao diện

Giao diện gốc nằm trong `design/*.dc.html` và được sửa trực tiếp trong repo này; không còn đồng bộ với file hay canvas bên ngoài. `npm run sync` chuyển chúng thành component React trong `src/generated/` (tự sinh, không commit). `npm run dev` và `npm run build` tự chạy bước này.

## Triển khai

Docker + Caddy + GitHub Webhook trên VPS.

- Hướng dẫn thiết lập từng bước (VPS, DNS, webhook, vận hành, xử lý sự cố): [docs/HUONG_DAN_CICD.md](docs/HUONG_DAN_CICD.md)
- Yêu cầu xem nhà, báo Telegram, link chia sẻ, PDF: [docs/HUONG_DAN_CICD.md mục 16](docs/HUONG_DAN_CICD.md#16-yêu-cầu-xem-nhà-báo-telegram-link-chia-sẻ-pdf)
- Dữ liệu nhà ở, tiện ích, trang quản trị: [docs/HUONG_DAN_CICD.md mục 15](docs/HUONG_DAN_CICD.md#15-dữ-liệu-nhà-ở-tiện-ích-và-trang-quản-trị)
- Bật trợ lý AI (khoá DeepSeek trên VPS): [docs/HUONG_DAN_CICD.md mục 14](docs/HUONG_DAN_CICD.md#14-bật-trợ-lý-ai-deepseek)
- Kế hoạch và kiến trúc ban đầu: [docs/KE_HOACH_TRIEN_KHAI.md](docs/KE_HOACH_TRIEN_KHAI.md)
