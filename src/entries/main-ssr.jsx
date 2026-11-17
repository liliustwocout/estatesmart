// Chỉ dùng lúc build: dựng HTML tĩnh của landing để trình duyệt hiện ngay và máy tìm kiếm đọc được.
import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './MainApp.jsx';

export function render() {
  return renderToString(<App />);
}
