// Sau `vite build`: dựng sẵn HTML của landing vào dist/index.html.
// Trình duyệt hiện trang ngay khi tải HTML (chưa cần chờ JS), máy tìm kiếm đọc được toàn bộ nội dung;
// src/entries/Main.jsx sau đó chỉ hydrate.
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const ssrDir = resolve('dist-ssr');
const { render } = await import(pathToFileURL(resolve(ssrDir, 'main-ssr.js')).href);
const file = resolve('dist/index.html');
const html = readFileSync(file, 'utf8');
const mark = '<div id="root"></div>';
if (!html.includes(mark)) throw new Error('Không tìm thấy <div id="root"></div> trong dist/index.html');
const app = render();
writeFileSync(file, html.replace(mark, `<div id="root">${app}</div>`));
rmSync(ssrDir, { recursive: true, force: true });
console.log(`prerender dist/index.html (${(app.length / 1024).toFixed(1)} KB HTML)`);
