#!/usr/bin/env bash
# Lấy code mới nhất của nhánh main và build lại container web.
# Toàn bộ logic nằm trong hàm main để bash đọc hết script trước khi git reset ghi đè file này.
set -euo pipefail

main() {
  local app_dir=/opt/estatesmart/app
  local log=/opt/estatesmart/deploy.log

  # Chỉ cho một lần deploy chạy tại một thời điểm.
  exec 9>/opt/estatesmart/deploy.lock
  flock 9

  {
    echo "=== $(date -Is) bắt đầu deploy"
    cd "$app_dir"
    git fetch --prune origin main
    git reset --hard origin/main
    export GIT_SHA
    GIT_SHA=$(git rev-parse --short HEAD)
    # Nếu build lỗi, lệnh dừng tại đây và container cũ vẫn tiếp tục chạy.
    docker compose up -d --build --remove-orphans
    docker image prune -f
    echo "=== $(date -Is) deploy xong: $GIT_SHA"
  } >> "$log" 2>&1
}

main "$@"
