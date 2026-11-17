import React from 'react';
import '../styles/interaction.css';
import '../mascot/guide.css';
import { createRoot } from 'react-dom/client';
import Listing from '../generated/Listing.jsx';
import JumpGuide from '../mascot/JumpGuide.jsx';
import { watchReveal } from '../styles/reveal.js';
import { smoothScroll } from '../styles/smoothScroll.js';

// Một Mascot nhảy tới section đang xem và nói một câu ngắn; thứ tự khoá = thứ tự section (so le trái, phải).
// Khoá trùng với data-guide và {{guide.khoá}} trong design/Listing.dc.html.
const LINES = {
  hero: ['04-tim-thay', 'Đây là điểm sống của căn này.'],
  specs: ['07-do-dac', 'Phòng ngủ, diện tích, pháp lý, xem giá trước nhé.'],
  rooms: ['05-soi-tin-dang', 'Bấm từng phòng để xem bố trí.'],
  location: ['09-ban-do', 'Vòng 15 phút đi bộ quanh nhà đây.'],
  eco: ['06-ong-nhom', 'Trường, chợ, công viên cách bao xa, xem ở đây.'],
  verdict: ['08-bieu-do', 'Ưu điểm, và vài điều nên tự kiểm chứng.'],
  contact: ['10-ngon-cai', 'Ưng rồi thì đặt lịch đi xem nhé!'],
};
// Chỗ trống đầu mỗi section để Mascot đáp xuống
const ANCHORS = Object.fromEntries(Object.keys(LINES).map((k) => [k, <span className="g-anchor" data-anchor={k} aria-hidden="true" />]));

createRoot(document.getElementById('root')).render(<><Listing guide={ANCHORS} /><JumpGuide lines={LINES} /></>);
watchReveal();
smoothScroll();
