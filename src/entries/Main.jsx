import React from 'react';
import '../styles/interaction.css';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './MainApp.jsx';
import { watchReveal } from '../styles/reveal.js';
import { smoothScroll } from '../styles/smoothScroll.js';
import { watchBalance } from '../styles/fitText.js';

// Bản build có sẵn HTML của landing (scripts/prerender.mjs) để hiện ngay và cho máy tìm kiếm đọc:
// khi đó chỉ gắn sự kiện (hydrate), không vẽ lại.
const root = document.getElementById('root');
if (root.firstElementChild) hydrateRoot(root, <App />);
else createRoot(root).render(<App />);

watchReveal();
smoothScroll();
watchBalance('.say');
