import React, { useState } from 'react';
import '../styles/interaction.css';
import '../mascot/guide.css';
import { createRoot } from 'react-dom/client';
import Listing from '../generated/Listing.jsx';
import SectionGuide from '../mascot/SectionGuide.jsx';
import { watchReveal } from '../styles/reveal.js';

// Các câu giới thiệu được đặt cạnh nội dung tương ứng trong design/Listing.dc.html.
const LINES = {
  hero: ['04-tim-thay', 'Đây là điểm phù hợp của mặt bằng này.'],
  specs: ['07-do-dac', 'Năm thông số chính, xem giá trước nhé.'],
  rooms: ['05-soi-tin-dang', 'Bấm từng không gian để xem công năng.'],
  location: ['09-ban-do', 'Lối vào, chỗ đỗ xe và tiện ích quanh đây.'],
  comp: ['06-ong-nhom', 'Đối thủ quanh đây và khoảng trống còn lại.'],
  verdict: ['08-bieu-do', 'Nhận định của mình: ưu điểm và rủi ro.'],
  contact: ['10-ngon-cai', 'Ưng rồi thì đặt lịch đi xem nhé!'],
};

function ListingPage() {
  const [muted, setMuted] = useState(false);
  const toggle = () => setMuted((value) => !value);
  const guide = Object.fromEntries(Object.entries(LINES).map(([section, line]) => [
    section, <SectionGuide line={line} muted={muted} onToggle={toggle} />,
  ]));
  return <Listing guide={guide} />;
}

createRoot(document.getElementById('root')).render(<ListingPage />);
watchReveal();
