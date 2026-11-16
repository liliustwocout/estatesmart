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
| `docker-compose.yml` | Hai container: `web` (nginx) và `caddy` (reverse proxy + HTTPS) |
| `deploy/Caddyfile` | Caddy: `/hooks/*` → webhook trên máy chủ cổng 9000, còn lại → `web`; `www` chuyển về tên chính |
| `deploy/hooks.json` | Luật của webhook: chỉ chạy khi chữ ký `X-Hub-Signature-256` đúng **và** `ref` là `refs/heads/main` |
| `deploy/deploy.sh` | Script deploy: khoá chống chạy trùng, lấy code mới, build và thay container, dọn image cũ, ghi log |
| `deploy/setup-vps.sh` | Cài đặt VPS lần đầu: Docker, swap, user `deploy`, clone repo, secret, dịch vụ webhook, tường lửa, deploy lần đầu |
| `.dockerignore` | Không đưa `node_modules`, `dist`, `.git`, `docs`… vào Docker build |

Các file **chỉ có trên VPS**, không nằm trong repo:

| File trên VPS | Nội dung |
|---|---|
| `/opt/estatesmart/webhook.env` | `WEBHOOK_SECRET=...` (quyền 600, chủ sở hữu `deploy`) |
| `/opt/estatesmart/app/.env` | `DOMAIN=estatesmart.site` cho docker compose (đã có trong `.gitignore`) |
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
| Log container web / caddy | `cd /opt/estatesmart/app && docker compose logs --tail=100 web` (hoặc `caddy`) |
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
