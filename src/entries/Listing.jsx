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
  hero: ['04-tim-thay', 'Bạn xem điểm sống của căn này nhé.'],
  specs: ['07-do-dac', 'Giá và thông tin căn nhà ở đây nhé.'],
  rooms: ['05-soi-tin-dang', 'Bấm vào từng phòng để xem nhé.'],
  location: ['09-ban-do', 'Mình xem bản đồ quanh nhà nhé.'],
  eco: ['06-ong-nhom', 'Bạn xem trường, chợ cách nhà bao xa nhé.'],
  verdict: ['08-bieu-do', 'Mình ghi lại vài điểm đáng xem kỹ.'],
  contact: ['10-ngon-cai', 'Bạn ưng căn này thì đặt lịch xem nhé!'],
};
// Chỗ trống đầu mỗi section để Mascot đáp xuống
const ANCHORS = Object.fromEntries(Object.keys(LINES).map((k) => [k, <span className="g-anchor" data-anchor={k} aria-hidden="true" />]));

createRoot(document.getElementById('root')).render(<><Listing guide={ANCHORS} /><JumpGuide lines={LINES} /></>);
watchReveal();
smoothScroll();
