# Máy chủ API (Node 22, không có thư viện ngoài nên không cần npm install).
# Cơ sở dữ liệu SQLite nằm ở /data (volume Docker), các bảng trống được nạp từ CSV mẫu.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8787 DB_PATH=/data/estatesmart.db
RUN mkdir -p /data && chown node:node /data
COPY package.json *.mjs ./
COPY data/buildings.csv data/homes.csv data/pois_manual.csv data/pois.json data/landmarks.json ./data/
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8787/api/health || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "server.mjs"]
