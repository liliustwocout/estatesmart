# estateSmartAI — Web

Landing page và bản mô phỏng MVP (trợ lý AI, hồ sơ mặt bằng) của dự án T020 — AI In Action.

| Đường dẫn | Trang |
|---|---|
| `/` | Landing |
| `/tro-ly/` | Trợ lý AI: chat bên trái, bản đồ 2D / mô hình 3D bên phải |
| `/mat-bang/` | Hồ sơ mặt bằng chi tiết |

## Chạy trên máy

```bash
npm install
npm run dev
```

## Cập nhật giao diện từ Claude Design

Giao diện gốc nằm trong `design/*.dc.html` (tải từ canvas Claude Design). `npm run sync` chuyển chúng thành component React trong `src/generated/` (tự sinh, không commit). `npm run dev` và `npm run build` tự chạy bước này.

## Triển khai

Docker + Caddy + GitHub Webhook trên VPS. Xem [docs/KE_HOACH_TRIEN_KHAI.md](docs/KE_HOACH_TRIEN_KHAI.md).
