# Hướng dẫn thiết lập CI/CD cho estateSmartAI

Tài liệu này hướng dẫn từng bước dựng toàn bộ đường đi từ `git push` tới website chạy trên VPS: chuẩn bị VPS, trỏ tên miền, cài Docker và dịch vụ, nối GitHub Webhook, kiểm tra, vận hành, thay webhook và xử lý sự cố.

Thông tin hiện tại của dự án:

| Mục | Giá trị |
|---|---|
| Repo | `https://github.com/liliustwocout/estatesmart` (nhánh `main`) |
| Tên miền | `estatesmart.site` (và `www.estatesmart.site` chuyển hướng về tên chính) |
| VPS | `103.28.35.137`, Ubuntu 24.04, 2 GB RAM |
| Thư mục trên VPS | `/opt/estatesmart` |
| Kiểm tra phiên bản đang chạy | `https://estatesmart.site/version.txt` |

> Khi đổi VPS, tên miền hoặc repo, thay các giá trị trên ở mọi lệnh bên dưới.

---

## Mục lục

1. [Cách hệ thống hoạt động](#1-cách-hệ-thống-hoạt-động)
2. [Các file cấu hình trong repo](#2-các-file-cấu-hình-trong-repo)
3. [Chuẩn bị](#3-chuẩn-bị)
4. [Bước 1: Cấu hình VPS](#4-bước-1-cấu-hình-vps)
5. [Bước 2: Trỏ tên miền (DNS)](#5-bước-2-trỏ-tên-miền-dns)
6. [Bước 3: Cài đặt và deploy lần đầu](#6-bước-3-cài-đặt-và-deploy-lần-đầu)
7. [Bước 4: Tạo GitHub Webhook](#7-bước-4-tạo-github-webhook)
8. [Bước 5: Kiểm tra toàn bộ đường đi](#8-bước-5-kiểm-tra-toàn-bộ-đường-đi)
9. [Thay webhook và đổi secret](#9-thay-webhook-và-đổi-secret)
10. [Đổi VPS, đổi tên miền, đổi repo](#10-đổi-vps-đổi-tên-miền-đổi-repo)
11. [Vận hành hằng ngày](#11-vận-hành-hằng-ngày)
12. [Xử lý sự cố](#12-xử-lý-sự-cố)
13. [Checklist](#13-checklist)
14. [Bật trợ lý AI (DeepSeek)](#14-bật-trợ-lý-ai-deepseek)
15. [Dữ liệu nhà ở, tiện ích và trang quản trị](#15-dữ-liệu-nhà-ở-tiện-ích-và-trang-quản-trị)
16. [Yêu cầu xem nhà, báo Telegram, link chia sẻ, PDF](#16-yêu-cầu-xem-nhà-báo-telegram-link-chia-sẻ-pdf)

---

## 1. Cách hệ thống hoạt động

```
Lập trình viên  ──git push──▶  GitHub (nhánh main)
                                  │
             ┌────────────────────┴─────────────────────┐
             ▼                                          ▼
   (CI) GitHub Actions                      (CD) GitHub Webhook
   npm ci + npm run build                   POST https://estatesmart.site/hooks/deploy
   docker build thử                          kèm chữ ký HMAC-SHA256 bằng secret
   → báo xanh/đỏ trên GitHub                          │
                                                       ▼
                         VPS 103.28.35.137 ─────────────────────────────────────────────┐
                         │ Caddy (container, cổng 80/443, tự cấp HTTPS Let's Encrypt)    │
                         │   ├─ /hooks/*  → webhook (dịch vụ systemd, cổng 9000)         │
                         │   │               kiểm tra chữ ký + nhánh main                │
                         │   │               └─ chạy deploy/deploy.sh:                   │
                         │   │                    git fetch + reset về origin/main       │
                         │   │                    docker compose up -d --build           │
                         │   └─ /*        → web (container nginx, phục vụ bản build)     │
                         └───────────────────────────────────────────────────────────────┘
```

- **CI** (kiểm tra) chạy trên máy của GitHub mỗi khi có pull request hoặc push lên `main`. CI chỉ báo kết quả, không deploy.
- **CD** (triển khai) do GitHub Webhook kích hoạt: mỗi push lên `main` gửi một request có chữ ký tới VPS, VPS tự lấy code mới và build lại.
- CI và CD chạy **song song, độc lập**. Deploy không chờ CI xanh. Nếu code lỗi build, `docker compose` dừng trước khi thay container nên **bản cũ vẫn chạy**, nhưng nên xem CI trước khi merge vào `main`.

---

## 2. Các file cấu hình trong repo

| File | Vai trò |
|---|---|
| `.github/workflows/ci.yml` | CI: cài Node 22, `npm ci`, `npm run build`, `docker build` thử |
| `Dockerfile` | Build 2 bước: Node 22 build web tĩnh → nginx 1.27 phục vụ. Ghi mã commit vào `version.txt` |
| `deploy/nginx.conf` | Cấu hình nginx trong container `web`: nén gzip, cache dài cho `/assets/`, không cache HTML và `version.txt` |
| `docker-compose.yml` | Ba container: `web` (nginx), `api` (trợ lý AI) và `caddy` (reverse proxy + HTTPS) |
| `api/` | Máy chủ API Node 22: chấm điểm sống 5 Agent, cơ sở dữ liệu SQLite, trang quản trị, gọi DeepSeek; có `Dockerfile` riêng (xem [mục 14](#14-bật-trợ-lý-ai-deepseek), [mục 15](#15-dữ-liệu-nhà-ở-tiện-ích-và-trang-quản-trị)) |
| `deploy/Caddyfile` | Caddy: `/hooks/*` → webhook trên máy chủ cổng 9000, `/api/*` → `api`, còn lại → `web`; `www` chuyển về tên chính |
| `deploy/hooks.json` | Luật của webhook: chỉ chạy khi chữ ký `X-Hub-Signature-256` đúng **và** `ref` là `refs/heads/main` |
| `deploy/deploy.sh` | Script deploy: khoá chống chạy trùng, lấy code mới, build và thay container, dọn image cũ, ghi log |
| `deploy/setup-vps.sh` | Cài đặt VPS lần đầu: Docker, swap, user `deploy`, clone repo, secret, dịch vụ webhook, tường lửa, deploy lần đầu |
| `.dockerignore` | Không đưa `node_modules`, `dist`, `.git`, `docs`… vào Docker build |

Các file **chỉ có trên VPS**, không nằm trong repo:

| File trên VPS | Nội dung |
|---|---|
| `/opt/estatesmart/webhook.env` | `WEBHOOK_SECRET=...` (quyền 600, chủ sở hữu `deploy`) |
| `/opt/estatesmart/app/.env` | `DOMAIN=estatesmart.site` cho docker compose (đã có trong `.gitignore`) |
| `/opt/estatesmart/api.env` | `DEEPSEEK_API_KEY`, `ADMIN_PASSWORD`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` cho container `api` (quyền 600, chủ sở hữu `deploy`) |
| Volume Docker `api_data` | Cơ sở dữ liệu `estatesmart.db`: căn nhà, toà nhà, tiện ích nhập tay, yêu cầu của khách (có thông tin cá nhân), link chia sẻ; giữ qua các lần deploy |
| `/opt/estatesmart/deploy.log` | Nhật ký mỗi lần deploy |
| `/opt/estatesmart/deploy.lock` | Khoá để không chạy 2 lần deploy cùng lúc |
| `/etc/systemd/system/estatesmart-webhook.service` | Dịch vụ webhook |

---

## 3. Chuẩn bị

- VPS Ubuntu **24.04** (hoặc 22.04), tối thiểu 1 CPU, 2 GB RAM, 20 GB ổ đĩa, có IPv4 công khai. Không dùng Ubuntu 20.04: đã hết hỗ trợ chuẩn và kho Docker chính thức không còn hỗ trợ.
- Quyền quản lý DNS của tên miền `estatesmart.site`.
- Quyền **Admin** trên repo GitHub (để tạo webhook).
- Máy cá nhân có `ssh` (Windows dùng Git Bash hoặc PowerShell đều được).

---

## 4. Bước 1: Cấu hình VPS

### 4.1 Đổi mật khẩu root và cài lại hệ điều hành

1. Vào panel nhà cung cấp VPS → **Reinstall OS** → chọn **Ubuntu 24.04**.
2. Đặt mật khẩu root mới, không dùng lại mật khẩu cũ (mật khẩu từng xuất hiện trong ảnh chụp màn hình coi như đã lộ).

### 4.2 Đăng nhập bằng SSH key

Trên **máy cá nhân**, tạo key (bỏ qua nếu đã có `~/.ssh/id_ed25519`):

```bash
ssh-keygen -t ed25519 -C "estatesmart-vps"
```

Chép public key lên VPS (nhập mật khẩu root một lần):

```bash
ssh-copy-id root@103.28.35.137
```

> Windows không có `ssh-copy-id`: dùng
> `type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@103.28.35.137 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"`

Thử đăng nhập lại, lần này không được hỏi mật khẩu:

```bash
ssh root@103.28.35.137
```

### 4.3 Tắt đăng nhập bằng mật khẩu

**Chỉ làm sau khi 4.2 đã đăng nhập được bằng key**, nếu không sẽ tự khoá mình ngoài VPS.

```bash
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
```

```bash
sudo systemctl restart ssh
```

Mở một cửa sổ terminal **mới** và thử `ssh root@103.28.35.137` trước khi đóng phiên đang mở.

### 4.4 Cập nhật hệ thống

```bash
apt-get update && apt-get -y upgrade
```

Swap, Docker, tường lửa sẽ do `setup-vps.sh` lo ở Bước 3.

---

## 5. Bước 2: Trỏ tên miền (DNS)

Vào trang quản lý DNS của nhà đăng ký tên miền, tạo hoặc sửa các bản ghi:

| Loại | Tên (Host) | Giá trị | TTL |
|---|---|---|---|
| A | `@` | `103.28.35.137` | 300 |
| A | `www` | `103.28.35.137` | 300 |

- **Xoá** mọi bản ghi `A`/`AAAA`/`CNAME` cũ khác cho `@` và `www` (ví dụ bản ghi trỏ về trang đỗ tên miền của nhà đăng ký). Bản ghi `AAAA` sai làm Let's Encrypt cấp chứng chỉ thất bại.
- Nếu dùng Cloudflare: để **DNS only** (đám mây xám) trong lúc cài đặt, để Caddy tự xin chứng chỉ.

Kiểm tra (đợi 5–30 phút sau khi lưu):

```bash
nslookup estatesmart.site
```

```bash
nslookup www.estatesmart.site
```

Cả hai phải trả về `103.28.35.137`. **Phải xong bước này trước Bước 3**, vì Caddy chỉ xin được chứng chỉ HTTPS khi tên miền đã trỏ đúng VPS và cổng 80/443 mở.

---

## 6. Bước 3: Cài đặt và deploy lần đầu

Đăng nhập VPS bằng root rồi tải script:

```bash
curl -fsSL https://raw.githubusercontent.com/liliustwocout/estatesmart/main/deploy/setup-vps.sh -o setup-vps.sh
```

Đọc qua nội dung trước khi chạy:

```bash
less setup-vps.sh
```

Chạy:

```bash
sudo REPO_URL=https://github.com/liliustwocout/estatesmart.git DOMAIN=estatesmart.site bash setup-vps.sh
```

Script làm lần lượt:

| # | Việc | Chi tiết |
|---|---|---|
| 1 | Cài gói | `ca-certificates curl git gnupg ufw webhook` |
| 2 | Swap 2 GB | `/swapfile`, ghi vào `/etc/fstab` để giữ sau khi khởi động lại. Cần cho `npm ci` + build trên VPS 2 GB RAM |
| 3 | Docker Engine + Compose plugin | Từ kho chính thức của Docker, bật `systemctl enable --now docker` |
| 4 | User `deploy` | Thuộc nhóm `docker`, sở hữu `/opt/estatesmart`. Webhook và deploy chạy bằng user này, không dùng root |
| 5 | Clone repo | Vào `/opt/estatesmart/app`, nhánh `main` |
| 6 | Secret webhook | Sinh ngẫu nhiên 32 byte vào `/opt/estatesmart/webhook.env` (chỉ tạo nếu chưa có) |
| 7 | File `.env` | `DOMAIN=...` trong `/opt/estatesmart/app/.env` |
| 8 | Dịch vụ `estatesmart-webhook` | systemd, chạy `webhook -hooks .../hooks.json -template -port 9000` |
| 9 | Tường lửa `ufw` | Mở SSH, 80, 443; cổng 9000 chỉ cho mạng Docker nội bộ `172.16.0.0/12` |
| 10 | Deploy lần đầu | Chạy `deploy.sh` → `docker compose up -d --build` |

Cuối cùng script in ra:

```
Hoàn tất. Secret cho GitHub Webhook (chỉ hiện ở đây, lưu vào GitHub rồi đóng cửa sổ):
<chuỗi 64 ký tự hex>
Payload URL: https://estatesmart.site/hooks/deploy
```

**Chép secret này để dùng ở Bước 4.** Nếu lỡ đóng cửa sổ, xem lại bằng:

```bash
sudo cut -d= -f2 /opt/estatesmart/webhook.env
```

### Kiểm tra sau khi cài

Hai container phải ở trạng thái `running`:

```bash
cd /opt/estatesmart/app && docker compose ps
```

Dịch vụ webhook phải `active (running)`:

```bash
systemctl status estatesmart-webhook --no-pager
```

Log deploy lần đầu kết thúc bằng dòng `deploy xong: <mã commit>`:

```bash
tail -n 20 /opt/estatesmart/deploy.log
```

Trên trình duyệt:
- `https://estatesmart.site` hiện trang chủ, ổ khoá HTTPS hợp lệ.
- `https://www.estatesmart.site` chuyển về `https://estatesmart.site`.
- `https://estatesmart.site/version.txt` hiện mã commit 7 ký tự, trùng với commit mới nhất trên `main`.

> Chứng chỉ HTTPS có thể mất 10–60 giây ở lần đầu. Nếu báo lỗi chứng chỉ, xem `docker compose logs caddy` (mục 12).

---

## 7. Bước 4: Tạo GitHub Webhook

Trên GitHub: repo `liliustwocout/estatesmart` → **Settings** → **Webhooks** → **Add webhook**.

| Trường | Giá trị |
|---|---|
| Payload URL | `https://estatesmart.site/hooks/deploy` |
| Content type | `application/json` (**bắt buộc**, `hooks.json` đọc `ref` từ JSON) |
| Secret | secret đã chép ở Bước 3 |
| SSL verification | **Enable SSL verification** |
| Which events | **Just the push event** |
| Active | Đánh dấu |

Bấm **Add webhook**. GitHub gửi ngay một sự kiện `ping`.

Vào webhook vừa tạo → tab **Recent Deliveries**:
- Sự kiện `ping` trả về mã **200** là đường truyền GitHub → Caddy → webhook đã thông.
- Nội dung phản hồi của `ping` có thể là `Hook rules were not satisfied.` vì `ping` không có `ref` là `main`. Đây là bình thường: webhook chỉ deploy khi có push lên `main`.

### Webhook kiểm tra những gì

`deploy/hooks.json` chỉ cho chạy `deploy.sh` khi **cả hai** điều kiện đúng:

1. Header `X-Hub-Signature-256` khớp với HMAC-SHA256 của nội dung request tính bằng `WEBHOOK_SECRET`. Request không có chữ ký hoặc sai secret bị từ chối.
2. Trường `ref` trong payload là `refs/heads/main`. Push lên nhánh khác bị bỏ qua.

Webhook trả lời GitHub ngay (`Đã nhận yêu cầu deploy`) và chạy deploy ở nền, nên GitHub không bị quá thời gian chờ.

### `deploy.sh` làm gì

1. Khoá `/opt/estatesmart/deploy.lock` bằng `flock` → nếu có 2 push liên tiếp, lần sau chờ lần trước xong.
2. `git fetch --prune origin main` rồi `git reset --hard origin/main`.
3. `docker compose up -d --build --remove-orphans` với `GIT_SHA` = mã commit mới (ghi vào `version.txt`).
4. `docker image prune -f` dọn image cũ.
5. Ghi toàn bộ vào `/opt/estatesmart/deploy.log`.

Nếu build lỗi, lệnh dừng ở bước 3 trước khi thay container: **bản đang chạy giữ nguyên**.

---

## 8. Bước 5: Kiểm tra toàn bộ đường đi

| # | Thử | Kết quả mong đợi | Xem ở đâu |
|---|---|---|---|
| 1 | Ping khi tạo webhook | Mã 200 | GitHub → Webhooks → Recent Deliveries |
| 2 | Push một commit thật lên `main` | Sau 1–3 phút trang đổi; `version.txt` đổi sang mã commit mới | `tail -f /opt/estatesmart/deploy.log`, `version.txt` |
| 3 | **Redeliver** một push cũ | Deploy chạy lại mà không cần commit mới | Log có thêm dòng `deploy xong` |
| 4 | Push lên nhánh khác (ví dụ `test/abc`) | Chỉ chạy CI, **không** deploy | `version.txt` không đổi |
| 5 | Gửi request giả không chữ ký | Bị từ chối | Lệnh bên dưới trả `Hook rules were not satisfied.` |
| 6 | Commit làm build lỗi (thử trên nhánh, không merge) | CI báo đỏ; nếu lỡ vào `main`, trang vẫn chạy bản cũ | GitHub Actions, `deploy.log` |

Thử request giả (mục 5):

```bash
curl -i -X POST https://estatesmart.site/hooks/deploy
```

Theo dõi một lần deploy trực tiếp trên VPS:

```bash
tail -f /opt/estatesmart/deploy.log
```

> **Không tạo commit rỗng** (`git commit --allow-empty`) chỉ để thử deploy. Dùng **Redeliver** trong Recent Deliveries hoặc chạy deploy thủ công (mục 11).

> Bấm **Redeliver** thì GitHub gửi lại **nguyên chữ ký cũ**. Vì vậy chỉ redeliver được những push gửi đi *sau* lần đổi secret gần nhất. Push gửi trước lần đổi sẽ nhận `Hook rules were not satisfied.`. Khi đó, thử bằng một payload tự ký trên VPS:
>
> ```bash
> S=$(sudo cut -d= -f2 /opt/estatesmart/webhook.env); B='{"ref":"refs/heads/main"}'
> SIG=$(printf '%s' "$B" | openssl dgst -sha256 -hmac "$S" | sed 's/^.*= //')
> curl -sS -X POST https://estatesmart.site/hooks/deploy -H 'Content-Type: application/json' -H "X-Hub-Signature-256: sha256=$SIG" -d "$B"
> ```
>
> Kết quả đúng là `Đã nhận yêu cầu deploy`, sau đó `deploy.log` có thêm dòng `deploy xong`.

---

## 9. Thay webhook và đổi secret

### 9.1 Đổi secret (khi nghi bị lộ, hoặc định kỳ)

Trên VPS, tạo secret mới và ghi đè file:

```bash
NEW_SECRET=$(openssl rand -hex 32)
echo "WEBHOOK_SECRET=$NEW_SECRET" | sudo tee /opt/estatesmart/webhook.env > /dev/null
sudo chown deploy:deploy /opt/estatesmart/webhook.env
sudo chmod 600 /opt/estatesmart/webhook.env
sudo systemctl restart estatesmart-webhook
echo "$NEW_SECRET"
```

Trên GitHub: **Settings → Webhooks → (webhook) → Edit** → dán secret mới vào **Secret** → **Update webhook**.

Kiểm tra: **Recent Deliveries → Redeliver** một push → mã 200 và log có `deploy xong`.

> Giữa lúc đổi trên VPS và lúc cập nhật trên GitHub, các push sẽ bị từ chối. Làm hai bước liền nhau, sau đó Redeliver push bị lỡ.

### 9.2 Xoá webhook cũ và tạo webhook mới

Dùng khi đổi repo, đổi tên miền hoặc webhook bị cấu hình sai:

1. GitHub → **Settings → Webhooks** → webhook cũ → **Delete webhook**.
2. Tạo webhook mới đúng như [Bước 4](#7-bước-4-tạo-github-webhook), dùng secret trong `/opt/estatesmart/webhook.env` (hoặc tạo secret mới theo 9.1).
3. Kiểm tra ping = 200, rồi Redeliver một push.

### 9.3 Đổi đường dẫn hoặc luật của webhook

Luật nằm trong `deploy/hooks.json` (trong repo). Ví dụ đổi nhánh deploy từ `main` sang `production`:

1. Sửa `"value": "refs/heads/main"` trong `deploy/hooks.json`, và `origin main` trong `deploy/deploy.sh`.
2. Commit, push.
3. Trên VPS, kéo code mới rồi khởi động lại dịch vụ để webhook đọc file mới:

```bash
sudo -u deploy git -C /opt/estatesmart/app pull
sudo systemctl restart estatesmart-webhook
```

Đường dẫn `/hooks/deploy` gồm tiền tố `/hooks/` (Caddy chuyển tiếp) và `id` trong `hooks.json`. Đổi `id` thì phải sửa Payload URL trên GitHub cho khớp.

---

## 10. Đổi VPS, đổi tên miền, đổi repo

### 10.1 Chuyển sang VPS mới (đổi IP)

1. Làm [Bước 1](#4-bước-1-cấu-hình-vps) trên VPS mới.
2. Sửa bản ghi DNS `A` của `@` và `www` sang IP mới ([Bước 2](#5-bước-2-trỏ-tên-miền-dns)), đợi `nslookup` trả IP mới.
3. Chạy `setup-vps.sh` trên VPS mới ([Bước 3](#6-bước-3-cài-đặt-và-deploy-lần-đầu)). Script sinh **secret mới**.
4. Cập nhật secret trên GitHub ([9.1](#91-đổi-secret-khi-nghi-bị-lộ-hoặc-định-kỳ), phần GitHub). Payload URL giữ nguyên vì dùng tên miền.
5. Gửi payload tự ký (xem ghi chú ở mục 8), vì push cũ mang chữ ký của secret cũ. Sau đó kiểm tra `version.txt`.
6. Tắt VPS cũ sau khi chắc chắn VPS mới chạy ổn.
7. Cập nhật IP trong tài liệu này và `docs/KE_HOACH_TRIEN_KHAI.md`.

### 10.2 Đổi tên miền

1. Trỏ DNS của tên miền mới về VPS.
2. Trên VPS, sửa `DOMAIN` rồi khởi động lại các container:

```bash
echo "DOMAIN=ten-mien-moi.com" | sudo -u deploy tee /opt/estatesmart/app/.env > /dev/null
cd /opt/estatesmart/app && sudo -u deploy docker compose up -d
```

3. Sửa Payload URL của webhook trên GitHub thành `https://ten-mien-moi.com/hooks/deploy`.
4. Đổi giá trị mặc định `estatesmart.site` trong `docker-compose.yml` và `deploy/setup-vps.sh` cho lần cài sau.

### 10.3 Chuyển sang repo khác hoặc đổi repo sang private

1. Đẩy code lên repo mới (bỏ qua nếu chỉ đổi `liliustwocout/estatesmart` sang private).
2. Trên VPS, đổi địa chỉ remote:

```bash
sudo -u deploy git -C /opt/estatesmart/app remote set-url origin https://github.com/<tổ-chức>/<repo>.git
```

3. Nếu repo mới là **private**, tạo deploy key chỉ đọc cho user `deploy`:

```bash
sudo -u deploy ssh-keygen -t ed25519 -N "" -f /home/deploy/.ssh/id_ed25519 -C "estatesmart-deploy"
sudo cat /home/deploy/.ssh/id_ed25519.pub
```

   - GitHub repo mới → **Settings → Deploy keys → Add deploy key** → dán public key, **không** tick *Allow write access*.
   - Chấp nhận host key của GitHub và đổi remote sang SSH:

```bash
sudo -u deploy ssh -o StrictHostKeyChecking=accept-new -T git@github.com
sudo -u deploy git -C /opt/estatesmart/app remote set-url origin git@github.com:<tổ-chức>/<repo>.git
```

4. Tạo webhook trên repo mới ([Bước 4](#7-bước-4-tạo-github-webhook)), **xoá** webhook ở repo cũ.
5. Redeliver một push để xác nhận.

---

## 11. Vận hành hằng ngày

| Việc | Lệnh (trên VPS) |
|---|---|
| Xem phiên bản đang chạy | `curl -s https://estatesmart.site/version.txt` |
| Xem log deploy | `tail -n 50 /opt/estatesmart/deploy.log` |
| Theo dõi deploy trực tiếp | `tail -f /opt/estatesmart/deploy.log` |
| Deploy thủ công (không cần push) | `sudo -u deploy /opt/estatesmart/app/deploy/deploy.sh` |
| Trạng thái container | `cd /opt/estatesmart/app && docker compose ps` |
| Log container web / api / caddy | `cd /opt/estatesmart/app && docker compose logs --tail=100 web` (hoặc `api`, `caddy`) |
| Log dịch vụ webhook | `journalctl -u estatesmart-webhook -n 100 --no-pager` |
| Khởi động lại webhook | `sudo systemctl restart estatesmart-webhook` |
| Dung lượng ổ đĩa | `df -h` và `docker system df` |

### Quay lại bản trước (rollback)

Tìm mã commit muốn quay về (trên GitHub hoặc bằng `git -C /opt/estatesmart/app log --oneline -10`), rồi:

```bash
cd /opt/estatesmart/app
sudo -u deploy git reset --hard <mã-commit>
sudo -u deploy env GIT_SHA=<mã-commit> docker compose up -d --build
```

Đây là cách chữa cháy: **lần push `main` kế tiếp sẽ deploy lại code mới nhất**. Cách bền vững là `git revert` commit lỗi trên máy cá nhân rồi push.

### Quy ước commit

- Chỉ commit vào `main` khi có thay đổi thật; mỗi push lên `main` là một lần deploy.
- Thử nghiệm trên nhánh phụ: chỉ chạy CI, không deploy.
- Thử lại deploy bằng **Redeliver** hoặc deploy thủ công, không dùng commit rỗng.

---

## 12. Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Recent Deliveries báo **502** | Dịch vụ webhook không chạy, hoặc tường lửa chặn cổng 9000 từ mạng Docker | `systemctl status estatesmart-webhook`; `sudo ufw status` phải có dòng cho `9000` từ `172.16.0.0/12` |
| Recent Deliveries báo **404** `Hook not found` | Payload URL sai `id` | URL phải là `/hooks/deploy`, khớp `"id": "deploy"` trong `hooks.json` |
| Push lên `main` nhưng phản hồi `Hook rules were not satisfied.` | Sai secret, hoặc Content type là `x-www-form-urlencoded` | Kiểm tra secret (9.1), đổi Content type sang `application/json` |
| Không có delivery nào sau khi push | Webhook không Active, hoặc chọn sai sự kiện | Settings → Webhooks: Active, *Just the push event* |
| Recent Deliveries báo lỗi SSL / timeout | DNS chưa trỏ đúng, HTTPS chưa được cấp, VPS tắt | `nslookup`, mở thử `https://estatesmart.site`, xem `docker compose logs caddy` |
| Trình duyệt báo lỗi chứng chỉ | Caddy chưa xin được chứng chỉ: DNS sai, có bản ghi `AAAA` thừa, cổng 80 bị chặn, hoặc vượt giới hạn Let's Encrypt | Sửa DNS, `sudo ufw status` (80/443 mở), `docker compose logs caddy`, đợi rồi `docker compose restart caddy` |
| Log dừng ở `npm ci`/`npm run build` kèm `Killed` | Hết RAM | Kiểm tra swap `swapon --show`; nếu vẫn thiếu, chuyển sang build image trên GitHub Actions rồi đẩy lên GHCR, VPS chỉ `docker pull` |
| `permission denied ... docker.sock` | User `deploy` chưa nhận nhóm `docker` | `sudo usermod -aG docker deploy && sudo systemctl restart estatesmart-webhook` |
| `fatal: detected dubious ownership` | Thư mục repo bị đổi chủ sở hữu (ví dụ thao tác git bằng root) | `sudo chown -R deploy:deploy /opt/estatesmart` và luôn chạy git bằng `sudo -u deploy` |
| Deploy chạy mà trang không đổi | Trình duyệt giữ cache, hoặc build lỗi nên container cũ vẫn chạy | So `version.txt` với commit mới; đọc cuối `deploy.log` |
| Hai push liền nhau, một lần "mất" | Không mất: lần sau chờ khoá `flock` rồi chạy | Xem `deploy.log` có đủ 2 dòng `deploy xong` |
| Ổ đĩa đầy | Image và build cache Docker tích tụ | `docker system prune -af` (xoá image không dùng), kiểm tra `df -h` |

---

## 13. Checklist

**VPS**
- [ ] Cài lại Ubuntu 24.04, đặt mật khẩu root mới
- [ ] Đăng nhập được bằng SSH key, đã tắt đăng nhập mật khẩu

**DNS**
- [ ] Bản ghi `A` cho `@` và `www` → `103.28.35.137`, không còn `AAAA`/`A` cũ
- [ ] `nslookup` trả đúng IP cho cả hai

**Cài đặt**
- [ ] Chạy `setup-vps.sh` thành công, đã lưu secret
- [ ] `docker compose ps` có `web` và `caddy` đang chạy
- [ ] `systemctl status estatesmart-webhook` là `active (running)`
- [ ] `https://estatesmart.site` mở được, HTTPS hợp lệ, `www` chuyển về tên chính
- [ ] `version.txt` đúng commit mới nhất

**Webhook**
- [ ] Tạo webhook: Payload URL, `application/json`, secret, SSL bật, chỉ push
- [ ] Ping trả 200
- [ ] Push thật lên `main` → `version.txt` đổi trong 1–3 phút
- [ ] Redeliver → deploy chạy lại
- [ ] Push nhánh phụ → không deploy
- [ ] `curl -X POST` không chữ ký → bị từ chối

**CI**
- [ ] Tab Actions có lượt chạy `CI` xanh cho commit mới nhất

---

## 14. Bật trợ lý AI (DeepSeek)

Container `api` (thư mục `api/`) nhận câu hỏi tự do ở trang Trợ lý tại `/api/chat`, gọi DeepSeek và trả lời dần từng đoạn chữ. Khi chưa có khoá API, trợ lý vẫn chạy luồng 5 câu hỏi như cũ, câu hỏi tự do nhận thông báo "chưa kết nối được trợ lý AI".

### 14.1 Lấy khoá và đặt lên VPS

1. Tạo khoá API tại trang quản lý của DeepSeek (platform.deepseek.com), nạp ít tiền để dùng.
2. Trên VPS, mở file khoá (script cài đặt đã tạo sẵn, quyền 600):

```bash
sudo -u deploy nano /opt/estatesmart/api.env
```

3. Điền dòng `DEEPSEEK_API_KEY=sk-...`, lưu lại, rồi khởi động lại container `api`:

```bash
cd /opt/estatesmart/app && sudo -u deploy docker compose up -d api
```

4. Kiểm tra: `curl -s https://estatesmart.site/api/health` phải trả `"llm":true`.

Nếu VPS được cài trước khi có trợ lý AI (chưa có file `api.env`), tạo file trước bước 2:

```bash
sudo install -m 600 -o deploy -g deploy /dev/null /opt/estatesmart/api.env
```

Không đưa khoá vào repo, vào code giao diện hay vào ảnh chụp màn hình. Nếu nghi bị lộ, xoá khoá trên trang DeepSeek, tạo khoá mới và làm lại bước 2–3.

### 14.2 Các biến cấu hình (trong `api.env`)

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `DEEPSEEK_API_KEY` | (trống) | Khoá API DeepSeek |
| `LLM_BASE_URL` | `https://api.deepseek.com` | Địa chỉ API theo chuẩn OpenAI; đổi để dùng nhà cung cấp khác |
| `LLM_MODEL` | `deepseek-chat` | Tên mô hình |
| `LLM_API_KEY` | (trống) | Khoá cho nhà cung cấp khác, được ưu tiên hơn `DEEPSEEK_API_KEY` |
| `LLM_MAX_TOKENS` | `500` | Độ dài tối đa một câu trả lời (token) |

Giới hạn chống spam và kiểm soát chi phí (bộ đếm nằm trong bộ nhớ, khởi động lại container thì về 0; "ngày" tính theo giờ Hà Nội):

| Biến | Mặc định | Ý nghĩa | Người dùng thấy |
|---|---|---|---|
| `MAX_CONCURRENT_PER_IP` | `1` | Mỗi IP chỉ có một câu trả lời đang chạy | "Trợ lý đang trả lời câu trước…" |
| `RATE_MIN_INTERVAL_MS` | `3000` | Khoảng cách tối thiểu giữa hai câu hỏi của một IP | "Anh/chị gửi hơi nhanh…" |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | `15` / `600000` | Tối đa 15 câu hỏi mỗi IP trong 10 phút | "Anh/chị đã hỏi nhiều trong ít phút…" |
| `IP_DAILY_LIMIT` | `60` | Tối đa 60 câu hỏi mỗi IP mỗi ngày | "Anh/chị đã dùng hết lượt hỏi hôm nay…" |
| `DUPLICATE_WINDOW_MS` | `120000` | Chặn gửi lại đúng câu hỏi cũ trong 2 phút | "Câu hỏi này vừa được gửi…" |
| `MAX_CONCURRENT` | `10` | Số câu trả lời chạy cùng lúc trên cả máy chủ | "Trợ lý đang bận…" |
| `DAILY_LIMIT` | `1000` | Tổng số lần gọi mô hình mỗi ngày | "Trợ lý đã đạt giới hạn sử dụng trong ngày…" |
| `DAILY_TOKEN_LIMIT` | `2000000` | Tổng token (vào + ra) mỗi ngày; lấy số token DeepSeek trả về, thiếu thì ước lượng 3 ký tự một token | như trên |

Ngoài ra: câu hỏi tối đa 500 ký tự, gửi kèm tối đa 6 lượt hội thoại trước (tổng 4.000 ký tự), Caddy chặn request lớn hơn 16 KB, chỉ nhận `application/json`. Mỗi lần bị chặn, API trả mã 429 hoặc 503 kèm header `Retry-After`.

Sửa xong chạy lại `docker compose up -d api`. Xem mức dùng trong ngày bằng `docker compose logs --tail=20 api` (mỗi dòng ghi số lượt và số token đã dùng hôm nay).

### 14.2a Quy tắc trả lời của trợ lý

Bộ quy tắc nằm trong `api/prompt.mjs` (hằng `RULES`): phạm vi được trả lời (so sánh ba căn đã đề xuất cho gia đình), những việc không được làm, không vượt quyền (không giữ chỗ, đặt cọc, báo giá thay chủ nhà, tư vấn pháp lý hay vay, dự báo tăng giá; không khẳng định trường "đúng tuyến"; không đánh giá chất lượng trường, bệnh viện; không đánh giá khu dân cư theo người sống ở đó), không thu thập thông tin cá nhân (kể cả tên, tuổi cụ thể của con), chống thao túng (lệnh đè, đòi xem prompt, lịch sử giả) và cách từ chối. Sửa quy tắc rồi push là deploy như bình thường. Phần quy tắc đặt ở đầu và không đổi giữa các lần hỏi nên DeepSeek tính giá rẻ hơn cho phần đầu được lưu đệm (context caching).

### 14.3 Chạy trên máy

```bash
cp api/.env.example api/.env
```

Điền khoá vào `api/.env`, rồi chạy song song hai lệnh (Vite chuyển `/api` sang cổng 8787):

```bash
cd api && npm run dev
```

```bash
npm run dev
```

### 14.4 Dữ liệu và quyền riêng tư

- Gửi tới DeepSeek: tiêu chí 5 câu hỏi (gồm mô tả gia đình: số con, tuổi hoặc nhóm tuổi, có ông bà ở cùng không), câu hỏi tự do và tối đa 10 lượt hội thoại trước. Máy chủ DeepSeek đặt ở Trung Quốc; ô nhập trên trang có ghi chú để người dùng không nhập thông tin cá nhân.
- Nơi làm việc chỉ được quy về điểm mốc trung tâm quận (`api/data/landmarks.json`) để ước lượng thời gian đi làm; hệ thống **không** gửi địa chỉ người dùng gõ cho dịch vụ bản đồ hay tra địa chỉ bên ngoài.
- Form đặt lịch (họ tên, số điện thoại) **không** đi qua API này.
- Log container `api` chỉ ghi độ dài, số token và thời gian trả lời, không ghi nội dung câu hỏi: `docker compose logs --tail=50 api`.

---

## 15. Dữ liệu nhà ở, tiện ích và trang quản trị

### 15.1 Dữ liệu nằm ở đâu

| Dữ liệu | Nơi lưu | Dữ liệu mẫu (chỉ nạp khi bảng trống) |
|---|---|---|
| Căn nhà: căn hộ, nhà đất; bán hoặc cho thuê; giá, phòng ngủ, tầng, pháp lý… | Bảng `homes` trong SQLite `/data/estatesmart.db` (volume Docker `api_data`) | `api/data/homes.csv`: 30 căn **mô phỏng** ở Vinhomes Ocean Park 1 |
| Toà chung cư: toạ độ, tiện ích nội khu (bể bơi, gym, sân chơi, lớp mầm non…), phí dịch vụ | Bảng `buildings` | `api/data/buildings.csv`: 7 toà, tiện ích nội khu là **mô phỏng** |
| Tiện ích nhập tay: thêm điểm OSM còn thiếu, sửa hoặc ẩn điểm OSM sai | Bảng `pois_manual` | `api/data/pois_manual.csv`: 2 dòng ẩn điểm OSM gắn nhầm |
| Tiện ích từ OpenStreetMap: trường (tách cấp học theo tên), chợ, siêu thị, y tế, công viên, sân chơi, thể thao, xe buýt… | `api/data/pois.json` (ảnh chụp OSM, nằm trong repo) | `cd api && npm run osm`, rồi commit file mới |
| Điểm mốc nơi làm việc (trung tâm quận) để ước lượng thời gian đi làm | `api/data/landmarks.json` | Sửa file rồi commit |
| Bản đồ nền | OpenFreeMap (miễn phí, không cần khoá) | Không cần làm gì |

Volume `api_data` được giữ qua các lần deploy. Sửa file CSV mẫu trong repo **không** ghi đè dữ liệu đang chạy; muốn nạp lại thì dùng *Nhập CSV*.

Hai lưu ý về dữ liệu OSM hiện có:
- OSM chưa có nhà thuốc nào trong khu. Loại tiện ích không có điểm nào thì **không tính vào điểm** (tránh trừ đều mọi căn), và trang kết quả ghi rõ "dữ liệu chưa có…". Thêm nhà thuốc bằng tiện ích nhập tay là điểm được tính ngay.
- OSM có 5 ga đường sắt đô thị **quy hoạch**, chưa vận hành. Hệ thống bỏ qua ga metro từ OSM; chỉ tính ga do quản trị viên nhập tay và đánh dấu *đã kiểm chứng*.

### 15.2 Bật trang quản trị

Trang quản trị chỉ bật khi có `ADMIN_PASSWORD` (tối thiểu 12 ký tự) trong `/opt/estatesmart/api.env`. `setup-vps.sh` tự tạo một mật khẩu ngẫu nhiên khi cài mới. Với VPS đã cài trước đó:

```bash
echo "ADMIN_PASSWORD=$(openssl rand -base64 18)" | sudo tee -a /opt/estatesmart/api.env > /dev/null
```

```bash
cd /opt/estatesmart/app && sudo -u deploy docker compose up -d api
```

Xem mật khẩu (chỉ trên VPS, không gửi qua chat hay email):

```bash
sudo grep ADMIN_PASSWORD /opt/estatesmart/api.env
```

Kiểm tra: `curl -s https://estatesmart.site/api/health` có `"admin":true`. Mở `https://estatesmart.site/quan-tri/` để đăng nhập.

Bảo vệ: sai mật khẩu 5 lần trong 15 phút thì IP bị khoá 15 phút; phiên đăng nhập 8 giờ, cookie `HttpOnly`, `Secure`, `SameSite=Strict`; khởi động lại container `api` thì mọi phiên bị đăng xuất. Đổi mật khẩu: sửa dòng `ADMIN_PASSWORD` rồi chạy lại lệnh `docker compose up -d api`.

### 15.3 Thêm dữ liệu thật

Trang quản trị hiện có bảng **căn nhà** (thêm, sửa, ẩn, nhập/xuất CSV). Tab **Toà nhà** và **Tiện ích** sẽ có khi làm lại trang quản trị (giai đoạn 5 trong `docs/KE_HOACH_DOI_CHU_DE.md`); trong lúc chờ, API đã sẵn: `/api/admin/buildings`, `/api/admin/pois` (GET danh sách, PUT `/<mã>` để thêm/sửa, DELETE, `/import`, `/export`).

**Căn nhà** (cột trong CSV):

| Cột | Giá trị |
|---|---|
| `type` | `can_ho`, `studio`, `duplex`, `penthouse` (chung cư); `nha_pho`, `lien_ke`, `biet_thu` (nhà đất) |
| `deal` | `ban` (cần `price_billion` tính bằng tỷ và `legal`) hoặc `thue` (cần `rent_million` tính bằng triệu/tháng) |
| `building` | Mã toà trong bảng `buildings` (căn hộ). Có mã toà thì `lat`, `lng`, `mgmt_fee` để trống sẽ lấy theo toà |
| `floor` / `floors` | Căn hộ ghi `floor` (tầng của căn); nhà đất ghi `floors` (số tầng) và `elevator` (có thang máy hay không) |
| `legal` | `so_hong`, `cho_so`, `hdmb` (hợp đồng mua bán) |
| `furnished` | `tho`, `co_ban`, `day_du` |
| `car_parking` | `ham`, `truoc_nha`, `gan`, `khong` |
| `direction` | `dong`, `tay`, `nam`, `bac`, `dong_nam`, `dong_bac`, `tay_nam`, `tay_bac` |

**Toà nhà:** cột `amenities` nhận `be_boi`, `gym`, `san_choi`, `vuon`, `mam_non`, `tien_loi`, cách nhau bằng `;`. Mỗi căn trong toà được tính các tiện ích này là "trong toà" (1 phút).

**Tiện ích nhập tay** (`pois_manual`):
- Thêm điểm OSM còn thiếu: để trống `osm_id`, điền `kind` (xem `api/poi-kinds.mjs`), tên, toạ độ. Trường phổ thông điền thêm `level`: `th`, `thcs`, `thpt`, `lc` (liên cấp).
- Sửa một điểm OSM (sai tên, sai vị trí, sai loại): điền `osm_id` (ví dụ `w1370266208`, xem trong `api/data/pois.json`) và giá trị đúng.
- Ẩn một điểm OSM sai: điền `osm_id`, đặt `hidden = 1`.
- Đánh dấu `verified = 1` khi đã đi kiểm tra tại chỗ; nguồn hiện trên trang là "Nhập tay, đã kiểm chứng".

Toạ độ lấy bằng cách nhấp chuột phải trên openstreetmap.org hoặc Google Maps. Có lỗi ở bất kỳ dòng nào trong file CSV thì không ghi dòng nào và trang báo dòng lỗi; chọn *Thay toàn bộ* để xoá các dòng không có trong file. Muốn tạm ẩn một căn thì đổi *Trạng thái* sang `hidden` thay vì xoá.

### 15.4 Sao lưu

```bash
cd /opt/estatesmart/app && sudo -u deploy docker compose cp api:/data/estatesmart.db /opt/estatesmart/backup-$(date +%F).db
```

Hoặc đơn giản hơn: tải *Xuất CSV* trên trang quản trị định kỳ.

### 15.5 Cách 5 Agent chấm điểm

Tính bằng code trong `api/engine.mjs` (không dùng mô hình ngôn ngữ, nên cùng tiêu chí luôn ra cùng kết quả). Công thức đầy đủ: [`docs/PHUONG_PHAP_CHAM_DIEM.md`](PHUONG_PHAP_CHAM_DIEM.md).

| Agent | Việc |
|---|---|
| Hiểu gia đình | Đọc 5 câu trả lời: mua hay thuê, loại nhà, ngân sách, thành phần gia đình (tuổi con, ông bà), nơi đi làm, tiện ích ưu tiên; suy ra số phòng ngủ cần |
| Sàng lọc căn | Đúng hình thức và loại nhà; loại căn vượt ngân sách (mua quá 10%, thuê quá 20%) hoặc thiếu từ 2 phòng ngủ; còn dưới 3 căn thì nới dần và ghi rõ đã nới gì |
| Học hành và sức khoẻ | Trường theo đúng cấp học của con, phòng khám, bệnh viện, nhà thuốc |
| Sinh hoạt và đi lại | Chợ, siêu thị, tiện lợi, công viên, sân chơi, thể thao, xe buýt, thời gian đi làm |
| Chấm điểm sống | Điểm 0–100 từ 6 thành phần (ngân sách 20, căn phù hợp 15, giáo dục 20, mua sắm và y tế 20, xanh và thể thao 10, đi lại 15), trọng số đổi theo gia đình; Top 3, ưu điểm, điều cần kiểm chứng, "một ngày của gia đình" |

Trợ lý chat nhận đúng dữ liệu, trọng số và điểm thành phần của ba căn đang hiển thị, nên giải thích được vì sao căn này xếp trên căn kia.

### 15.6 Chuyển từ dữ liệu mặt bằng (chủ đề cũ)

Lần deploy đầu tiên sau khi đổi chủ đề, container `api` tự tạo ba bảng mới và nạp dữ liệu mẫu. Không cần làm gì thêm.
- Bảng `listings` (mặt bằng kinh doanh) **được giữ nguyên, không xoá**, chỉ không còn được dùng. Muốn dọn hẳn thì sao lưu trước (mục 15.4) rồi xoá bảng bằng `sqlite3`.
- Yêu cầu khách cũ (bảng `leads`) giữ nguyên, vẫn hiện ở tab Yêu cầu.
- Link chia sẻ tạo trước khi đổi chủ đề trỏ tới mã mặt bằng cũ, khi mở trả về "Link này thuộc phiên bản cũ… không còn hiệu lực" (mã 410).

---

## 16. Yêu cầu xem nhà, báo Telegram, link chia sẻ, PDF

### 16.1 Yêu cầu từ khách

Hai nơi gửi yêu cầu, đều lưu vào bảng `leads` trong cơ sở dữ liệu và hiện ở `/quan-tri/` → tab **Yêu cầu**:

| Nơi gửi | Nội dung |
|---|---|
| Trang hồ sơ `/mat-bang/` (sau này `/nha/`) → form đặt lịch xem nhà | Họ tên, số điện thoại, vai trò (người mua, người thuê, người thân, môi giới, khác), ngày muốn xem, lời nhắn |
| Trang Trợ lý → Báo cáo đầy đủ → "Gửi cho chủ nhà" | Họ tên, số điện thoại, tin nhắn soạn sẵn từ tiêu chí |

- Khách phải tích ô đồng ý mới gửi được. Số điện thoại được chuẩn hoá về dạng `0xxxxxxxxx`.
- Chống spam: ô bẫy ẩn cho bot, mỗi IP tối đa 5 yêu cầu/giờ, toàn hệ thống 200/ngày; gửi trùng (cùng số, cùng căn trong 10 phút) không tạo bản ghi mới.
- Log máy chủ chỉ ghi mã yêu cầu và mã căn, **không ghi** họ tên hay số điện thoại.
- Trong tab Yêu cầu: đổi trạng thái (Mới, Đã gọi, Đã hẹn xem nhà, Đã đóng), ghi chú nội bộ, xoá, xuất CSV. Xoá yêu cầu khi không còn cần để không giữ thông tin cá nhân lâu.

### 16.2 Bật báo tin qua Telegram

1. Trên Telegram, nhắn cho **@BotFather** lệnh `/newbot`, đặt tên, nhận **token** dạng `123456789:AA...`.
2. Tạo nhóm Telegram của đội (hoặc dùng chat riêng), thêm bot vào nhóm, gửi một tin bất kỳ trong nhóm.
3. Lấy **chat id**: mở `https://api.telegram.org/bot<TOKEN>/getUpdates` trên trình duyệt, tìm `"chat":{"id": ...}` (nhóm thường là số âm, ví dụ `-1001234567890`).
4. Trên VPS, thêm vào `/opt/estatesmart/api.env`:

```bash
sudo -u deploy nano /opt/estatesmart/api.env
```

```
TELEGRAM_BOT_TOKEN=123456789:AA...
TELEGRAM_CHAT_ID=-1001234567890
```

5. Khởi động lại và kiểm tra `"telegram":true`:

```bash
cd /opt/estatesmart/app && sudo -u deploy docker compose up -d api && curl -s https://estatesmart.site/api/health
```

Mỗi yêu cầu mới sẽ được nhắn vào nhóm: loại yêu cầu, mã căn, tên, số điện thoại, ngày muốn xem, lời nhắn và link quản trị. Lưu ý: số điện thoại của khách sẽ nằm trong lịch sử chat Telegram, nên chỉ thêm người cần thiết vào nhóm. Token lộ thì vào @BotFather → `/revoke` để tạo token mới.

### 16.3 Link chia sẻ kết quả

Nút **Chia sẻ kết quả** dưới danh sách trong trang Trợ lý lưu tiêu chí và ba mã căn (bảng `shares`, không có thông tin cá nhân), tạo link `https://estatesmart.site/tro-ly/?phien=<mã>`. Link hết hạn sau 90 ngày; khi mở, điểm số được tính lại theo dữ liệu hiện tại; căn đã ẩn hoặc xoá sẽ không hiện. Link không còn căn nào (kể cả link của chủ đề mặt bằng cũ) trả về "không còn hiệu lực".

### 16.4 Tải PDF hồ sơ

Nút **Tải PDF** ở đầu trang hồ sơ mở hộp thoại in của trình duyệt; chọn "Lưu dưới dạng PDF". Bản in dùng nền trắng, bỏ thanh menu và form, giữ ảnh, thông số, tiện ích quanh nhà, nhận định và nguồn dữ liệu.
