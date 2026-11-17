// Cây React của landing, dùng chung cho trình duyệt (Main.jsx) và bước dựng sẵn HTML (main-ssr.jsx).
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Main from '../generated/Main.jsx';
import Mascot from '../mascot/Mascot.jsx';

// Mascot tương tác ở hero: design/Main.dc.html chừa chỗ trống <div data-mascot="hero">,
// gắn vào bằng portal để dùng chung một cây React với trang (docs/KE_HOACH_MASCOT.md mục 4).
const heroSize = () => (window.innerWidth <= 820 ? 104 : window.innerWidth <= 1024 ? 150 : 184);
const GUIDE = 'Lướt xuống, mình dẫn bạn đi xem nhé!';

function HeroMascot() {
  const [slot, setSlot] = useState(null);
  const [size, setSize] = useState(184);
  const [say, setSay] = useState(null);
  useEffect(() => {
    setSlot(document.querySelector('[data-mascot="hero"]'));
    setSize(heroSize());
    const onResize = () => setSize(heroSize());
    window.addEventListener('resize', onResize);
    const intro = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('mascot', {
        detail: { name: 'hero', lock: false, play: [
          ['01-chao', 1600, 'Chào bạn!'],
          ['00-dung-yen', 2200, 'Mình là trợ lý lựa nhà!'],
        ] },
      }));
      setSay(GUIDE);
    }, 1000);
    return () => { window.removeEventListener('resize', onResize); clearTimeout(intro); };
  }, []);
  if (!slot) return null;
  return createPortal(<Mascot interactive name="hero" size={size} say={say} side={size <= 104 ? 'left' : undefined} />, slot);
}

export default function App() {
  return <><Main /><HeroMascot /></>;
}
