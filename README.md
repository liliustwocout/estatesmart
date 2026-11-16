# estateSmartAI — Web

Landing page và bản mô phỏng MVP (trợ lý AI, hồ sơ mặt bằng) của dự án T020 — AI In Action.

| Đường dẫn | Trang |
|---|---|
| `/` | Landing |
| `/tro-ly/` | Trợ lý AI: chat bên trái, bản đồ 2D / mô hình 3D bên phải |
| `/mat-bang/` | Hồ sơ mặt bằng chi tiết |
| `/quan-tri/` | Quản trị mặt bằng (đăng nhập bằng mật khẩu): thêm, sửa, ẩn, nhập và xuất CSV |
| `/api/` | Máy chủ API (`api/`): 5 Agent chấm điểm, SQLite, trợ lý AI (DeepSeek) |

## Chạy trên máy

```bash
npm install
npm run dev
```

Trợ lý, bản đồ kết quả và hồ sơ cần thêm máy chủ API. Khoá DeepSeek và `ADMIN_PASSWORD` đặt trong `api/.env` (mẫu ở `api/.env.example`); cơ sở dữ liệu tự tạo ở `api/data/local.db` từ `api/data/listings.csv`:

```bash
cd api && npm run dev
```

## Sửa giao diện

Giao diện gốc nằm trong `design/*.dc.html` và được sửa trực tiếp trong repo này; không còn đồng bộ với file hay canvas bên ngoài. `npm run sync` chuyển chúng thành component React trong `src/generated/` (tự sinh, không commit). `npm run dev` và `npm run build` tự chạy bước này.

## Triển khai

Docker + Caddy + GitHub Webhook trên VPS.

- Hướng dẫn thiết lập từng bước (VPS, DNS, webhook, vận hành, xử lý sự cố): [docs/HUONG_DAN_CICD.md](docs/HUONG_DAN_CICD.md)
- Dữ liệu mặt bằng, trang quản trị, cách chấm điểm: [docs/HUONG_DAN_CICD.md mục 15](docs/HUONG_DAN_CICD.md#15-dữ-liệu-mặt-bằng-và-trang-quản-trị)
- Bật trợ lý AI (khoá DeepSeek trên VPS): [docs/HUONG_DAN_CICD.md mục 14](docs/HUONG_DAN_CICD.md#14-bật-trợ-lý-ai-deepseek)
- Kế hoạch và kiến trúc ban đầu: [docs/KE_HOACH_TRIEN_KHAI.md](docs/KE_HOACH_TRIEN_KHAI.md)
