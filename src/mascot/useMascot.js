// Máy trạng thái của Mascot: idle / react / sequence / drag / sleep.
// Chép đúng logic của design/mascot/index.html (docs/KE_HOACH_MASCOT.md mục 3), thêm cảm ứng.
//   idle      đứng ở tư thế nghỉ (prop `pose`), hẹn giờ 10 s nhìn quanh, 30 s ngủ
//   react     đang diễn một phản ứng ngắn khi bấm/vuốt; bấm tiếp vẫn được
//   sequence  chuỗi bị khoá (chóng mặt, sự kiện từ trang); bấm/vuốt bị bỏ qua
//   drag      đang bị nhấc lên
//   sleep     ngủ gật; di chuột / chạm là tỉnh dậy chào
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export const REST = '00-dung-yen';

const REACTIONS = [
  ['01-chao', 'Chào bạn!'],
  ['13-an-mung', 'Hay quá!'],
  ['10-ngon-cai', 'Đi tìm nhà nhé?'],
  ['04-tim-thay', 'Để mình tìm cho!'],
];

const T = {
  react: 1400, pet: 2200, dizzy: 2600, look: 3000, wake: 1300,
  lookAfter: 10000, sleepAfter: 30000,
  tapWindow: 2000, taps: 5,
  petWindow: 1200, petFlips: 4, petSwipe: 40,
  dragPx: 6, holdMs: 400,
  eyeX: 5, eyeY: 4, eyeReach: 220,
};

export default function useMascot({ rest = REST, interactive = false, follow = interactive, listen = interactive, name, onPose }) {
  const rootRef = useRef(null);
  const [pose, setPose] = useState(rest);
  const [text, setText] = useState(null);
  const [lift, setLift] = useState(null); // {x, y} khi đang kéo

  const opts = useRef({});
  opts.current = { rest, interactive, onPose };

  // Trạng thái nội bộ giữ trong ref để các listener không bị closure cũ.
  const s = useRef(null);
  if (!s.current) s.current = { mode: 'idle', pose: rest, timers: [], idle: [], taps: [], ri: 0, pet: { dir: 0, flips: 0, last: 0, x: 0 }, drag: null, eye: { x: 0, y: 0 } };
  const st = s.current;

  const show = useCallback((slug) => {
    st.pose = slug;
    setPose(slug);
    opts.current.onPose?.(slug);
  }, [st]);

  const clear = useCallback(() => { st.timers.forEach(clearTimeout); st.timers = []; }, [st]);
  const later = useCallback((ms, fn) => { st.timers.push(setTimeout(fn, ms)); }, [st]);

  const armIdle = useCallback(() => {
    st.idle.forEach(clearTimeout);
    st.idle = [];
    if (!opts.current.interactive) return;
    st.idle = [
      setTimeout(() => {
        if (st.mode !== 'idle' || st.pose !== opts.current.rest) return;
        show('06-ong-nhom');
        later(T.look, () => { if (st.mode === 'idle' && st.pose === '06-ong-nhom') show(opts.current.rest); });
      }, T.lookAfter),
      setTimeout(() => {
        if (st.mode !== 'idle' && st.mode !== 'react') return;
        clear(); st.mode = 'sleep'; setText(null); show('17-ngu-gat');
      }, T.sleepAfter),
    ];
  }, [st, show, later, clear]);

  // Chuỗi tư thế: [[slug, ms, câu nói?], ...] rồi quay về tư thế nghỉ.
  const play = useCallback((seq, lock = false) => {
    clear();
    st.mode = lock ? 'sequence' : 'react';
    let t = 0;
    for (const [slug, ms, line] of seq) {
      const step = () => { show(slug); setText(line || null); };
      if (t === 0) step(); else later(t, step);
      t += ms;
    }
    later(t, () => { st.mode = 'idle'; setText(null); show(opts.current.rest); armIdle(); });
  }, [st, clear, later, show, armIdle]);

  // Có người đụng tới: đánh thức nếu đang ngủ, không thì đặt lại hẹn giờ rảnh rỗi.
  const poke = useCallback(() => {
    if (st.mode === 'sleep') { play([['01-chao', T.wake, 'Ơ, mình ngủ quên à?']]); return true; }
    if (st.mode === 'idle' || st.mode === 'react') armIdle();
    return false;
  }, [st, play, armIdle]);

  const tap = useCallback(() => {
    if (poke()) return;
    const now = performance.now();
    st.taps = st.taps.filter((x) => now - x < T.tapWindow).concat(now);
    if (st.taps.length >= T.taps) { st.taps = []; play([['15-chong-mat', T.dizzy, 'Chóng mặt quá…']], true); return; }
    if (st.mode === 'sequence' || st.mode === 'drag') return;
    const [slug, line] = REACTIONS[st.ri++ % REACTIONS.length];
    play([[slug, T.react, line]]);
  }, [st, poke, play]);

  const pet = useCallback(() => {
    if (st.mode === 'sequence' || st.mode === 'drag' || st.mode === 'sleep') return;
    play([['14-duoc-vuot', T.pet, 'Hihi, nhột quá!']]);
  }, [st, play]);

  // ---- Mắt nhìn theo ----
  const applyEyes = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const v = `translate(${st.eye.x.toFixed(1)} ${st.eye.y.toFixed(1)})`;
    el.querySelectorAll('.eyes').forEach((g) => g.setAttribute('transform', v));
  }, [st]);
  useLayoutEffect(applyEyes, [pose, applyEyes]); // SVG mới sau mỗi lần đổi tư thế

  // Tư thế nghỉ đổi từ ngoài (trang điều khiển Mascot bằng prop)
  useEffect(() => {
    if (st.mode === 'idle' && st.pose !== rest) show(rest);
  }, [rest, st, show]);

  // Con trỏ chuột trên cả trang: mắt nhìn theo, rê qua lại trên đầu = vuốt, đánh thức.
  useEffect(() => {
    if (!follow && !interactive) return undefined;
    let raf = 0;
    let at = null;
    const onMove = (e) => {
      if (e.pointerType === 'touch') return; // điện thoại: không có mắt nhìn theo
      at = e;
      const el = rootRef.current;
      if (interactive && el && !st.drag && st.mode !== 'sequence' && st.mode !== 'sleep') {
        const r = el.getBoundingClientRect();
        const inHead = e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.top + r.height * 0.66;
        if (inHead) {
          const dir = Math.sign(e.clientX - st.pet.x);
          st.pet.x = e.clientX;
          if (dir && dir !== st.pet.dir) {
            const now = performance.now();
            st.pet.flips = now - st.pet.last < T.petWindow ? st.pet.flips + 1 : 1;
            st.pet.last = now; st.pet.dir = dir;
            if (st.pet.flips >= T.petFlips) { st.pet.flips = 0; pet(); }
          }
        }
      }
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (interactive) poke();
        const node = rootRef.current;
        if (!follow || !node || !at) return;
        const r = node.getBoundingClientRect();
        const dx = at.clientX - (r.left + r.width / 2);
        const dy = at.clientY - (r.top + r.height * 0.48);
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(d / T.eyeReach, 1);
        st.eye = { x: (dx / d) * k * T.eyeX, y: (dy / d) * k * T.eyeY };
        applyEyes();
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => { window.removeEventListener('pointermove', onMove); if (raf) cancelAnimationFrame(raf); };
  }, [follow, interactive, st, pet, poke, applyEyes]);

  // ---- Kéo thả (chuột: kéo quá 6px; cảm ứng: giữ 400 ms rồi kéo) ----
  const beginLift = useCallback(() => {
    const el = rootRef.current;
    const d = st.drag;
    if (!el || !d) return;
    const box = (el.parentElement || document.body).getBoundingClientRect();
    const r = el.getBoundingClientRect();
    d.lifted = true;
    d.bounds = {
      minX: Math.min(0, box.left - r.left), maxX: Math.max(0, box.right - r.right),
      minY: Math.min(0, box.top - r.top), maxY: Math.max(0, box.bottom - r.bottom),
    };
    try { el.setPointerCapture(d.id); } catch { /* con trỏ đã nhả */ }
    clear(); st.mode = 'drag'; setText(null); show('16-bi-nhac-len');
    setLift({ x: 0, y: 0 });
  }, [st, clear, show]);

  const endDrag = useCallback((cancelled) => {
    const d = st.drag;
    if (!d) return;
    clearTimeout(d.hold);
    st.drag = null;
    if (d.lifted) {
      setLift(null); // CSS nảy về chỗ
      play([['16-bi-nhac-len', 550], ['13-an-mung', 900, 'Hạ cánh!']]);
      return;
    }
    if (!cancelled && !d.used && !d.moved) tap();
  }, [st, play, tap]);

  const onPointerDown = useCallback((e) => {
    if (!interactive || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const touch = e.pointerType === 'touch';
    const r = rootRef.current.getBoundingClientRect();
    st.drag = {
      id: e.pointerId, x: e.clientX, y: e.clientY, touch, moved: false, used: false, lifted: false,
      onHead: e.clientY < r.top + r.height * 0.66, hold: 0, bounds: null,
    };
    if (touch) {
      st.drag.hold = setTimeout(() => { if (st.drag && !st.drag.moved && !st.drag.used) beginLift(); }, T.holdMs);
    } else {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* bỏ qua */ }
    }
  }, [interactive, st, beginLift]);

  const onPointerMove = useCallback((e) => {
    const d = st.drag;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.lifted) {
      if (Math.hypot(dx, dy) <= T.dragPx) return;
      if (!d.touch) { beginLift(); } else {
        d.moved = true; clearTimeout(d.hold);
        // Vuốt ngang trên đầu = được vuốt
        if (!d.used && d.onHead && Math.abs(dx) > T.petSwipe && Math.abs(dx) > 2 * Math.abs(dy)) { d.used = true; pet(); }
        return;
      }
    }
    const b = d.bounds;
    setLift({ x: Math.max(b.minX, Math.min(b.maxX, dx)), y: Math.max(b.minY, Math.min(b.maxY, dy)) });
  }, [st, beginLift, pet]);

  const onPointerUp = useCallback((e) => { if (st.drag?.id === e.pointerId) endDrag(false); }, [st, endDrag]);
  const onPointerCancel = useCallback((e) => { if (st.drag?.id === e.pointerId) endDrag(true); }, [st, endDrag]);

  const onKeyDown = useCallback((e) => {
    if (!interactive || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    if (!e.repeat) tap();
  }, [interactive, tap]);

  // Cảm ứng: khi đã nhấc lên thì chặn cuộn trang; giữ lâu không bật menu ngữ cảnh.
  useEffect(() => {
    const el = rootRef.current;
    if (!interactive || !el) return undefined;
    const onTouchMove = (e) => { if (st.drag?.lifted) e.preventDefault(); };
    const onMenu = (e) => e.preventDefault();
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('contextmenu', onMenu);
    return () => { el.removeEventListener('touchmove', onTouchMove); el.removeEventListener('contextmenu', onMenu); };
  }, [interactive, st]);

  // API sự kiện cho trang khác:
  // window.dispatchEvent(new CustomEvent('mascot', { detail: { play: [['13-an-mung', 2000, 'Đã lưu hồ sơ!']], name?, lock? } }))
  useEffect(() => {
    if (!listen) return undefined;
    const onEvent = (e) => {
      const d = e.detail || {};
      if (d.name && d.name !== name) return;
      if (!Array.isArray(d.play) || !d.play.length) return;
      if (st.drag) return;
      play(d.play, d.lock !== false);
    };
    window.addEventListener('mascot', onEvent);
    return () => window.removeEventListener('mascot', onEvent);
  }, [listen, name, st, play]);

  // Khởi động / dọn dẹp hẹn giờ
  useEffect(() => {
    armIdle();
    return () => { clear(); st.idle.forEach(clearTimeout); if (st.drag) clearTimeout(st.drag.hold); };
  }, [interactive, armIdle, clear, st]);

  return {
    rootRef, pose, text, lift, play,
    handlers: interactive ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onKeyDown } : {},
  };
}
