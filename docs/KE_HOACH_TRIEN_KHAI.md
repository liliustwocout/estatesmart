# Kế hoạch triển khai CI/CD, hạ tầng và tên miền — estateSmartAI

**Mục tiêu:** mỗi commit mới trên nhánh `main` → VPS tự lấy code mới, build lại → người dùng mở `https://estatesmart.site` thấy phiên bản mới.

**Repo:** `liliustwocout/estatesmart` là repo chính thức, nguồn duy nhất để deploy. Thư mục dự án này độc lập, không phụ thuộc file nào bên ngoài repo.

---

## 1. Kiến trúc

```
Dev push lên main
      │
      ▼
GitHub ──(1) GitHub Actions: build kiểm tra (CI)
      │
      └─(2) Webhook POST https://estatesmart.site/hooks/deploy  (ký HMAC bằng secret)
                        │
VPS 103.28.35.137       ▼
┌───────────────────────────────────────────────────────────┐
│ Caddy (Docker, cổng 80/443, HTTPS tự động Let's Encrypt)  │
│   ├─ /hooks/*  → webhook (systemd, cổng 9000, user deploy)│
│   │               └─ deploy.sh: git fetch + reset main    │
│   │                             docker compose up --build │
│   └─ /*        → web (Docker: nginx phục vụ bản build)    │
└───────────────────────────────────────────────────────────┘
```

| Thành phần | Vai trò | File trong repo |
|---|---|---|
| `web` | Build Vite trong Docker, phục vụ bằng nginx | `Dockerfile`, `deploy/nginx.conf` |
| `caddy` | Reverse proxy, HTTPS tự động, chuyển `www` về tên miền chính | `docker-compose.yml`, `deploy/Caddyfile` |
| `webhook` | Nhận sự kiện push từ GitHub, kiểm tra chữ ký và nhánh, chạy deploy | `deploy/hooks.json`, `deploy/deploy.sh` |
| CI | Build thử mỗi PR và mỗi lần push main | `.github/workflows/ci.yml` |
| Cài đặt VPS | Docker, swap, user `deploy`, tường lửa, dịch vụ webhook | `deploy/setup-vps.sh` |
| Kiểm tra phiên bản | Mã commit đang chạy | `https://estatesmart.site/version.txt` |

---

## 2. Quy tắc commit khi thử nghiệm (tránh commit giả)

1. **Một commit khởi tạo** chứa toàn bộ web và hạ tầng. Không đẩy từng file lẻ.
2. **Thử webhook không cần commit:** GitHub → Settings → Webhooks → Recent Deliveries → **Redeliver** gửi lại đúng sự kiện push cũ, VPS deploy lại.
3. **Thử nghiệm trên nhánh phụ:** webhook chỉ deploy khi `ref == refs/heads/main`. Push lên nhánh `test/*` chỉ chạy CI, không deploy.
4. **Chỉ commit vào `main` khi có thay đổi thật** (giao diện, nội dung, hạ tầng). Gom nhiều chỉnh sửa vào một commit có mô tả rõ.
5. Không dùng `git commit --allow-empty` để kích hoạt deploy.

---

## 3. Bước 1 — VPS (2 GB RAM, 1–2 CPU, Ubuntu 24.04)

| Việc | Cách làm | Ghi chú |
|---|---|---|
| **Đổi mật khẩu root ngay** | Panel nhà cung cấp hoặc `passwd` | Mật khẩu hiện tại đã xuất hiện trong ảnh chụp màn hình, coi như đã lộ |
| **Cài lại hệ điều hành Ubuntu 24.04 (hoặc 22.04)** | Panel nhà cung cấp → Reinstall OS | Ubuntu 20.04 đã hết hỗ trợ chuẩn từ 05/2025; kho Docker chính thức không còn hỗ trợ 20.04 |
| Đăng nhập bằng SSH key | Máy cá nhân: `ssh-keygen -t ed25519`, rồi `ssh-copy-id root@103.28.35.137` | |
| Tắt đăng nhập bằng mật khẩu | `/etc/ssh/sshd_config`: `PasswordAuthentication no`, `systemctl restart ssh` | Làm sau khi đã đăng nhập được bằng key |
| Swap 2 GB | Script `setup-vps.sh` tự tạo | `npm ci` + build trên 2 GB RAM cần thêm swap |

---

## 4. Bước 2 — Gắn tên miền `estatesmart.site`

Tại trang quản lý DNS của nhà đăng ký tên miền:

| Loại | Tên | Giá trị | TTL |
|---|---|---|---|
| A | `@` | `103.28.35.137` | 300 |
| A | `www` | `103.28.35.137` | 300 |

Kiểm tra (đợi 5–30 phút):

```bash
nslookup estatesmart.site
```

Kết quả phải trả về `103.28.35.137`. **Phải xong bước này trước Bước 3**, vì Caddy chỉ xin được chứng chỉ HTTPS khi tên miền đã trỏ đúng về VPS và cổng 80/443 mở.

---

## 5. Bước 3 — Docker và container dự án

Đăng nhập VPS rồi chạy (một lần):

```bash
curl -fsSL https://raw.githubusercontent.com/liliustwocout/estatesmart/main/deploy/setup-vps.sh -o setup-vps.sh
```

```bash
sudo REPO_URL=https://github.com/liliustwocout/estatesmart.git DOMAIN=estatesmart.site bash setup-vps.sh
```

Script sẽ:
1. Cài `git`, `ufw`, `webhook`, Docker Engine + Compose từ kho chính thức của Docker.
2. Tạo swap 2 GB, user `deploy` (thuộc nhóm `docker`), thư mục `/opt/estatesmart`.
3. Clone repo vào `/opt/estatesmart/app`, sinh `WEBHOOK_SECRET` vào `/opt/estatesmart/webhook.env` (quyền 600).
4. Cài dịch vụ `estatesmart-webhook` (systemd), mở tường lửa cho 22/80/443.
5. Deploy lần đầu: `docker compose up -d --build` (container `web` + `caddy`).
6. In ra **secret** và **Payload URL** để dùng ở Bước 4.

Kiểm tra:

```bash
docker compose -f /opt/estatesmart/app/docker-compose.yml ps
```

Mở `https://estatesmart.site` thấy landing page, `https://estatesmart.site/version.txt` thấy mã commit.

---

## 6. Bước 4 — GitHub Webhook (CD)

GitHub repo → **Settings → Webhooks → Add webhook**:

| Trường | Giá trị |
|---|---|
| Payload URL | `https://estatesmart.site/hooks/deploy` |
| Content type | `application/json` |
| Secret | secret do `setup-vps.sh` in ra |
| SSL verification | Enable |
| Events | **Just the push event** |

Webhook trên VPS chỉ chạy deploy khi **cả hai** điều kiện đúng:
- Chữ ký `X-Hub-Signature-256` khớp secret (chặn request giả mạo).
- `ref` là `refs/heads/main` (push nhánh khác bị bỏ qua).

`deploy.sh` khi được gọi:
1. Khoá `flock` để không chạy 2 lần deploy cùng lúc.
2. `git fetch` + `git reset --hard origin/main`.
3. `docker compose up -d --build` với `GIT_SHA` = mã commit mới.
4. Dọn image cũ, ghi log vào `/opt/estatesmart/deploy.log`.

Nếu build lỗi, lệnh dừng trước khi thay container, **phiên bản cũ vẫn chạy**.

---

## 7. Kiểm thử nghiệm thu

| # | Đầu vào | Kết quả mong đợi | Cách kiểm tra |
|---|---|---|---|
| 1 | GitHub gửi ping khi tạo webhook | Recent Deliveries trả `200` | GitHub → Webhooks → Recent Deliveries |
| 2 | Một commit thật lên `main` | Trong 1–3 phút trang hiển thị nội dung mới | `version.txt` đổi sang mã commit mới; `tail -f /opt/estatesmart/deploy.log` |
| 3 | Redeliver một push cũ | Deploy chạy lại, không cần commit mới | Log có thêm một dòng "deploy xong" |
| 4 | Push nhánh `test/*` | Không deploy, chỉ chạy CI | `version.txt` không đổi |
| 5 | Request giả không có chữ ký | Bị từ chối | `curl -X POST https://estatesmart.site/hooks/deploy` trả "Hook rules were not satisfied" |
| 6 | Commit làm build lỗi (thử trên nhánh, không merge) | CI báo đỏ; nếu lỡ vào main, trang vẫn chạy bản cũ | GitHub Actions, `deploy.log` |

---

## 8. Repo private (nếu sau này chuyển repo sang private)

Repo hiện clone qua HTTPS nên phải để public. Nếu đổi sang private: tạo deploy key chỉ đọc cho user `deploy`, thêm vào repo → Settings → Deploy keys, rồi đổi remote trên VPS sang `git@github.com:liliustwocout/estatesmart.git`. Chi tiết ở `docs/HUONG_DAN_CICD.md` mục 10.3.

---

## 9. Vận hành và rủi ro

| Rủi ro | Cách xử lý |
|---|---|
| Hết RAM khi build | Swap 2 GB; nếu vẫn thiếu, chuyển sang build image trên GitHub Actions rồi đẩy lên GHCR, VPS chỉ `docker pull` |
| Lộ secret webhook | Tạo secret mới trong `/opt/estatesmart/webhook.env`, `systemctl restart estatesmart-webhook`, cập nhật trên GitHub |
| Cần quay lại bản trước | `git -C /opt/estatesmart/app reset --hard <commit>` rồi `docker compose up -d --build` (lần push main kế tiếp sẽ ghi đè) |
| Chứng chỉ HTTPS | Caddy tự gia hạn; dữ liệu chứng chỉ nằm trong volume `caddy_data` |
| Đầy ổ đĩa | `deploy.sh` đã `docker image prune`; kiểm tra định kỳ `df -h` |
| VPS hết hạn | Bật tự động gia hạn hoặc đặt lịch nhắc trước ngày hết hạn |

---

## 10. Checklist

- [ ] Đổi mật khẩu root, cài lại Ubuntu 24.04, đăng nhập bằng SSH key
- [ ] Bản ghi DNS A `@` và `www` → `103.28.35.137`, `nslookup` trả đúng IP
- [ ] Push commit khởi tạo lên `liliustwocout/estatesmart`
- [ ] Chạy `setup-vps.sh`, mở được `https://estatesmart.site`
- [ ] Tạo GitHub Webhook, ping trả 200
- [ ] Redeliver → deploy chạy lại, `version.txt` đúng
- [ ] Commit thật đầu tiên → trang cập nhật trong 1–3 phút
