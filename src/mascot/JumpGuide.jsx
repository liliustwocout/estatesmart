// Một Mascot duy nhất dẫn đường ở trang hồ sơ: cuộn tới section nào, Mascot nhảy (theo đường vòng cung)
// tới chỗ trống đầu section đó rồi nói một câu ngắn. Các section so le: trái, phải, trái…
// Chỗ đứng là các <span data-anchor="khoá"> do design/Listing.dc.html chừa sẵn ({{guide.khoá}}).
//   <JumpGuide lines={{ hero: ['04-tim-thay', 'Câu ngắn'], ... }} />
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Mascot from './Mascot.jsx';

const REDUCE = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sizeFor = () => (window.innerWidth <= 640 ? 56 : 68);
const heightOf = (w) => Math.round((w * 190) / 160);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default function JumpGuide({ lines }) {
  const keys = Object.keys(lines);
  const [key, setKey] = useState(null);
  const [flying, setFlying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [size, setSize] = useState(sizeFor);
  const elRef = useRef(null);
  const posRef = useRef(null); // {x, y} theo toạ độ trang
  const animRef = useRef(null);
  const keyRef = useRef(null);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const side = key ? (keys.indexOf(key) % 2 === 0 ? 'left' : 'right') : 'left';

  // Chỗ đứng của Mascot trong section `k` (toạ độ trang): sát mép trái hoặc phải của khoảng trống đã chừa.
  const spot = (k) => {
    const a = document.querySelector(`[data-anchor="${k}"]`);
    if (!a) return null;
    const r = a.getBoundingClientRect();
    const w = sizeRef.current, h = heightOf(w);
    const left = keys.indexOf(k) % 2 === 0;
    return { x: (left ? r.left : r.right - w) + window.scrollX, y: r.bottom - h + window.scrollY };
  };
  const place = (p) => { const el = elRef.current; if (el) el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`; };

  const jumpTo = (k) => {
    const el = elRef.current;
    const to = spot(k);
    if (!el || !to) return;
    // Đang bay dở: bắt đầu lại từ vị trí hiện tại
    let from = posRef.current;
    if (animRef.current) {
      const r = el.getBoundingClientRect();
      from = { x: r.left + window.scrollX, y: r.top + window.scrollY };
      animRef.current.cancel();
      animRef.current = null;
    }
    if (!from || REDUCE || !el.animate) { posRef.current = to; place(to); setFlying(false); return; }
    // Chỗ cũ đã ra khỏi màn hình: nhảy vào từ mép màn hình cho thấy được cú nhảy
    const top = window.scrollY, bottom = top + window.innerHeight;
    const h = heightOf(sizeRef.current);
    if (from.y + h < top - 40) from = { x: from.x, y: top - h - 20 };
    else if (from.y > bottom + 40) from = { x: from.x, y: bottom + 20 };
    const dx = to.x - from.x, dy = to.y - from.y;
    const dist = Math.hypot(dx, dy);
    const dur = Math.min(950, 480 + dist * 0.35);
    const lift = Math.min(170, 70 + Math.abs(dx) * 0.12); // độ cao vòng cung
    const N = 30;
    const frames = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const e = easeInOut(t);
      const x = from.x + dx * e;
      const y = from.y + dy * e - lift * 4 * e * (1 - e);
      // Nhún khi bật lên, duỗi người khi bay, nhún khi chạm đất
      let sx = 1, sy = 1;
      if (t < 0.12) { const q = Math.sin((t / 0.12) * Math.PI); sx = 1 + 0.14 * q; sy = 1 - 0.16 * q; }
      else if (t > 0.86) { const q = Math.sin(((t - 0.86) / 0.14) * Math.PI); sx = 1 + 0.16 * q; sy = 1 - 0.18 * q; }
      else { const q = Math.sin(((t - 0.12) / 0.74) * Math.PI); sx = 1 - 0.05 * q; sy = 1 + 0.07 * q; }
      const rot = (dx >= 0 ? 1 : -1) * 8 * Math.sin(t * Math.PI);
      frames.push({ offset: t, transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})` });
    }
    setFlying(true);
    const anim = el.animate(frames, { duration: dur, easing: 'linear', fill: 'forwards' });
    animRef.current = anim;
    anim.onfinish = () => {
      if (animRef.current !== anim) return;
      posRef.current = to;
      place(to);
      anim.cancel();
      animRef.current = null;
      setFlying(false);
    };
  };

  // Section đang nằm ở giữa màn hình
  useEffect(() => {
    let raf = 0;
    const pick = () => {
      raf = 0;
      const mid = window.innerHeight * 0.5;
      let best = null;
      for (const el of document.querySelectorAll('[data-guide]')) {
        const r = el.getBoundingClientRect();
        if (r.top <= mid && r.bottom >= mid) { best = el.getAttribute('data-guide'); break; }
      }
      if (!best && window.scrollY < 40) best = keys[0];
      if (best && best !== keyRef.current && lines[best]) { keyRef.current = best; setKey(best); jumpTo(best); }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(pick); };
    const t = setTimeout(pick, 700);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { clearTimeout(t); if (raf) cancelAnimationFrame(raf); window.removeEventListener('scroll', onScroll); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Trang đổi bố cục (ảnh tải xong, đổi hồ sơ, đổi cỡ cửa sổ): đứng lại đúng chỗ, không nhảy
  useEffect(() => {
    let raf = 0;
    const resnap = () => {
      raf = 0;
      if (!keyRef.current || animRef.current) return;
      const p = spot(keyRef.current);
      if (p && (!posRef.current || Math.abs(p.x - posRef.current.x) > 1 || Math.abs(p.y - posRef.current.y) > 1)) { posRef.current = p; place(p); }
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(resnap); };
    const onResize = () => { setSize(sizeFor()); queue(); };
    const ro = new ResizeObserver(queue);
    ro.observe(document.body);
    const mo = new MutationObserver(queue);
    const root = document.getElementById('root');
    if (root) mo.observe(root, { childList: true, subtree: true });
    window.addEventListener('resize', onResize);
    return () => { ro.disconnect(); mo.disconnect(); window.removeEventListener('resize', onResize); if (raf) cancelAnimationFrame(raf); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const line = key ? lines[key] : null;
  const say = line && !flying && !muted ? line[1] : null;
  const pose = flying ? '16-bi-nhac-len' : line ? line[0] : '01-chao';
  return createPortal(
    <div className={'j-guide' + (key ? ' is-on' : '')} ref={elRef}>
      <button type="button" className="j-guide-btn" onClick={() => setMuted((m) => !m)}
        aria-label={muted ? 'Bật lời giới thiệu của Mascot' : 'Ẩn lời giới thiệu của Mascot'} aria-pressed={!muted}>
        <Mascot pose={pose} size={size} say={say} side={side === 'left' ? 'right' : 'left'} />
      </button>
      <span className="j-guide-sr" aria-live="polite">{line && !muted ? line[1] : ''}</span>
    </div>,
    document.body,
  );
}
