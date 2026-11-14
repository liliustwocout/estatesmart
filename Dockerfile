# Bước 1: build web tĩnh bằng Node
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG GIT_SHA=dev
RUN npm run build && echo "$GIT_SHA" > dist/version.txt

# Bước 2: phục vụ bằng nginx
FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
