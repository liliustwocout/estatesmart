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
  hero: ['04-tim-thay', 'Đây là điểm phù hợp của mặt bằng này.'],
  specs: ['07-do-dac', 'Năm thông số chính, xem giá trước nhé.'],
  rooms: ['05-soi-tin-dang', 'Bấm từng không gian để xem công năng.'],
  location: ['09-ban-do', 'Lối vào, chỗ đỗ xe và tiện ích quanh đây.'],
  comp: ['06-ong-nhom', 'Đối thủ quanh đây và khoảng trống còn lại.'],
  verdict: ['08-bieu-do', 'Nhận định của mình: ưu điểm và rủi ro.'],
  contact: ['10-ngon-cai', 'Ưng rồi thì đặt lịch đi xem nhé!'],
};
// Chỗ trống đầu mỗi section để Mascot đáp xuống
const ANCHORS = Object.fromEntries(Object.keys(LINES).map((k) => [k, <span className="g-anchor" data-anchor={k} aria-hidden="true" />]));

createRoot(document.getElementById('root')).render(<><Listing guide={ANCHORS} /><JumpGuide lines={LINES} /></>);
watchReveal();
smoothScroll();
