# estateSmartAI — Web

Landing page và bản mô phỏng MVP (trợ lý AI, hồ sơ mặt bằng) của dự án T020 — AI In Action.

| Đường dẫn | Trang |
|---|---|
| `/` | Landing |
| `/tro-ly/` | Trợ lý AI: chat bên trái, bản đồ 2D / mô hình 3D bên phải |
| `/mat-bang/` | Hồ sơ mặt bằng chi tiết |
| `/api/` | Máy chủ API (`api/`): trợ lý AI trả lời câu hỏi tự do bằng DeepSeek |

## Chạy trên máy

```bash
npm install
npm run dev
```

Trợ lý AI cần thêm máy chủ API (khoá DeepSeek đặt trong `api/.env`, mẫu ở `api/.env.example`):

```bash
cd api && npm run dev
```

## Sửa giao diện

Giao diện gốc nằm trong `design/*.dc.html` và được sửa trực tiếp trong repo này; không còn đồng bộ với file hay canvas bên ngoài. `npm run sync` chuyển chúng thành component React trong `src/generated/` (tự sinh, không commit). `npm run dev` và `npm run build` tự chạy bước này.

## Triển khai

Docker + Caddy + GitHub Webhook trên VPS.

- Hướng dẫn thiết lập từng bước (VPS, DNS, webhook, vận hành, xử lý sự cố): [docs/HUONG_DAN_CICD.md](docs/HUONG_DAN_CICD.md)
- Bật trợ lý AI (khoá DeepSeek trên VPS): [docs/HUONG_DAN_CICD.md mục 14](docs/HUONG_DAN_CICD.md#14-bật-trợ-lý-ai-deepseek)
- Kế hoạch và kiến trúc ban đầu: [docs/KE_HOACH_TRIEN_KHAI.md](docs/KE_HOACH_TRIEN_KHAI.md)
