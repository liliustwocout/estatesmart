import React, { useEffect, useState } from 'react';
import '../styles/interaction.css';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import Main from '../generated/Main.jsx';
import Mascot from '../mascot/Mascot.jsx';

// Mascot tương tác ở hero: design/Main.dc.html chừa chỗ trống <div data-mascot="hero">,
// gắn vào bằng portal để dùng chung một cây React với trang (docs/KE_HOACH_MASCOT.md mục 4).
const heroSize = () => (window.innerWidth <= 820 ? 104 : window.innerWidth <= 1024 ? 150 : 184);

function HeroMascot() {
  const [slot, setSlot] = useState(null);
  const [size, setSize] = useState(heroSize);
  useEffect(() => {
    setSlot(document.querySelector('[data-mascot="hero"]'));
    const onResize = () => setSize(heroSize());
    window.addEventListener('resize', onResize);
    // Chào một lần khi chữ ở hero đã hiện xong, rồi về tư thế đứng yên
    const t = setTimeout(() => window.dispatchEvent(new CustomEvent('mascot', {
      detail: { name: 'hero', lock: false, play: [['01-chao', 1800, 'Chào bạn!']] },
    })), 1100);
    return () => { window.removeEventListener('resize', onResize); clearTimeout(t); };
  }, []);
  return slot ? createPortal(<Mascot interactive name="hero" size={size} />, slot) : null;
}

createRoot(document.getElementById('root')).render(<><Main /><HeroMascot /></>);
