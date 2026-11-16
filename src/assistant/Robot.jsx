// Avatar robot của trợ lý: mắt nhìn theo con trỏ, chớp mắt, ăng-ten nhấp nháy; nhún khi đang suy nghĩ.
import React, { useEffect, useRef } from 'react';

export default function Robot({ thinking = false, size = 40 }) {
  const ref = useRef(null);
  useEffect(() => {
    let raf = 0;
    let at = null;
    const onMove = (e) => {
      at = { x: e.clientX, y: e.clientY };
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = ref.current;
        if (!el || !at) return;
        const r = el.getBoundingClientRect();
        const dx = at.x - (r.left + r.width / 2);
        const dy = at.y - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(d / 160, 1);
        el.style.setProperty('--lx', ((dx / d) * k).toFixed(3));
        el.style.setProperty('--ly', ((dy / d) * k).toFixed(3));
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => { window.removeEventListener('pointermove', onMove); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return (
    <span ref={ref} className={'robot' + (thinking ? ' is-thinking' : '')} style={{ width: size, height: size }} aria-hidden="true">
      <svg className="botmark" width={size * 0.74} height={size * 0.74} viewBox="0 0 32 32" fill="none">
        <g className="bot-head">
          <path d="M16 7.5V4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle className="bot-ant" cx="16" cy="3.4" r="2" fill="#D39A6A" />
          <rect x="3" y="13" width="3.2" height="7" rx="1.6" fill="currentColor" />
          <rect x="25.8" y="13" width="3.2" height="7" rx="1.6" fill="currentColor" />
          <rect x="5.5" y="7.5" width="21" height="18" rx="6" fill="currentColor" />
          <rect x="8.5" y="11" width="15" height="9" rx="4.5" fill="#1F1C19" />
          <g className="bot-look"><g className="bot-eyes">
            <circle cx="12.9" cy="15.5" r="1.9" fill="#D39A6A" />
            <circle cx="19.1" cy="15.5" r="1.9" fill="#D39A6A" />
          </g></g>
          <path d="M13.6 22.3q2.4 1.6 4.8 0" stroke="#1F1C19" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </svg>
    </span>
  );
}
