// Mascot: <Mascot pose="00-dung-yen" size={160} interactive={false} say="…" />
// Hình lấy từ poses.js (tự sinh bởi design/mascot/gen_mascot.py); hoạt ảnh là CSS trong SVG.
// Xem docs/KE_HOACH_MASCOT.md mục 3, 5, 6.
import React, { useEffect, useInsertionEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { POSES, STYLE, META } from './poses.js';
import useMascot, { REST } from './useMascot.js';
import { fitBalance } from '../styles/fitText.js';
import './mascot.css';

const VIEW = Object.fromEntries(META.map((m) => [m.slug, m.viewBox]));
export const MASCOT_POSES = META;

// CSS hoạt ảnh chèn một lần cho cả trang (mọi lớp có tiền tố m-, không đụng CSS của trang).
let styleAdded = false;
function addStyle() {
  if (styleAdded || typeof document === 'undefined') return;
  styleAdded = true;
  const el = document.createElement('style');
  el.setAttribute('data-mascot', '');
  el.textContent = STYLE;
  document.head.appendChild(el);
}

const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Mascot({
  pose = REST,
  size = 160,
  interactive = false,
  follow = interactive,
  listen = interactive,
  name,
  say,
  onPose,
  className = '',
  style,
  side, // 'left': bong bóng nằm bên trái thay vì phía trên
}) {
  useInsertionEffect(addStyle, []);
  const rest = POSES[pose] ? pose : REST;
  const m = useMascot({ rest, interactive, follow, listen, name, onPose });
  // Mascot tĩnh (không tương tác, không nghe sự kiện) vẽ thẳng theo prop, không trễ một khung hình
  const slug = !interactive && !listen ? rest : POSES[m.pose] ? m.pose : rest;

  const vb = VIEW[slug] || '0 0 160 190';
  const [, , vw, vh] = vb.split(' ').map(Number);
  const html = useMemo(
    () => `<svg class="mascot-art" viewBox="${vb}" focusable="false" aria-hidden="true">${POSES[slug]}</svg>`,
    [slug, vb],
  );

  // Giữ câu nói cũ trong lúc bong bóng mờ dần
  const line = m.text ?? say ?? null;
  const lastLine = useRef('');
  if (line) lastLine.current = line;

  // Tạm dừng hoạt ảnh khi Mascot ra khỏi màn hình hoặc tab bị ẩn
  const paused = useRef(false);
  const syncPause = () => {
    const el = m.rootRef.current;
    if (!el) return;
    el.classList.toggle('is-paused', paused.current);
    const svg = el.querySelector('svg');
    // SMIL (sao quay ở tư thế chóng mặt) không theo CSS: dừng tay
    if (svg?.pauseAnimations) (paused.current || reduceMotion() ? svg.pauseAnimations() : svg.unpauseAnimations());
  };
  useLayoutEffect(syncPause, [html]);

  // Bong bóng co vừa khít, không để 1–2 chữ rớt dòng (src/styles/fitText.js)
  const bubbleRef = useRef(null);
  useLayoutEffect(() => { fitBalance(bubbleRef.current); }, [lastLine.current, side, size]);
  useEffect(() => {
    const fit = () => fitBalance(bubbleRef.current);
    window.addEventListener('resize', fit);
    document.fonts?.ready.then(fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  useEffect(() => {
    const el = m.rootRef.current;
    if (!el) return undefined;
    let inView = true;
    const update = () => { paused.current = !inView || document.hidden; syncPause(); };
    const io = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(([en]) => { inView = en.isIntersecting; update(); })
      : null;
    io?.observe(el);
    document.addEventListener('visibilitychange', update);
    return () => { io?.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cls = ['mascot', interactive && 'is-interactive', m.lift && 'is-lifted', className].filter(Boolean).join(' ');
  const a11y = interactive
    ? { role: 'button', tabIndex: 0, 'aria-label': 'Mascot, trợ lý của estateSmartAI' }
    : { 'aria-hidden': true };

  return (
    <div
      ref={m.rootRef}
      className={cls}
      data-pose={slug}
      data-side={side}
      style={{
        ...style,
        width: size,
        height: Math.round((size * vh) / vw),
        transform: m.lift ? `translate(${m.lift.x}px, ${m.lift.y}px)` : undefined,
      }}
      {...a11y}
      {...m.handlers}
    >
      <span ref={bubbleRef} className={'mascot-bubble' + (line ? ' is-on' : '')} aria-hidden="true">{lastLine.current && <span key={lastLine.current} className="mascot-line">{lastLine.current}</span>}</span>
      <span className="mascot-svg" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
