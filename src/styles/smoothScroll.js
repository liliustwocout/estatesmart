// Cuộn có quán tính cho con lăn chuột: mỗi nấc cuộn đẩy “đích” đi xa hơn, trang trượt dần tới đích
// nên lăn nhanh thì đi xa, ngừng lăn vẫn trôi thêm một quãng ngắn rồi mới dừng êm.
// Màn hình cảm ứng đã có quán tính sẵn nên không can thiệp; bàn di chuột chỉ được làm mượt nhẹ.
// Bàn phím, kéo thanh cuộn, bấm link neo vẫn chạy kiểu gốc; vùng cuộn con (textarea, danh sách) giữ nguyên.
export function smoothScroll({ ease = 130, speed = 1 } = {}) {
  if (typeof window === 'undefined') return () => {};
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touchOnly = window.matchMedia('(hover: none)').matches;
  if (reduce || touchOnly) return () => {};

  const doc = document.documentElement;
  let target = window.scrollY;
  let current = window.scrollY;
  let raf = 0;
  let last = 0;
  let active = false;

  const max = () => doc.scrollHeight - window.innerHeight;
  const clamp = (v) => Math.min(max(), Math.max(0, v));
  const go = (y) => window.scrollTo({ top: y, behavior: 'instant' });

  // Phần tử con nào còn cuộn được theo hướng này thì để nó tự cuộn.
  const nestedCanScroll = (el, dy) => {
    for (let n = el; n && n !== document.body && n !== doc; n = n.parentElement) {
      if (n.scrollHeight <= n.clientHeight + 1) continue;
      const oy = getComputedStyle(n).overflowY;
      if (oy !== 'auto' && oy !== 'scroll') continue;
      if (dy < 0 ? n.scrollTop > 0 : n.scrollTop + n.clientHeight < n.scrollHeight - 1) return true;
    }
    return false;
  };

  const tick = (t) => {
    const dt = last ? Math.min(64, t - last) : 16;
    last = t;
    current += (target - current) * (1 - Math.exp(-dt / ease));
    if (Math.abs(target - current) < 0.4) current = target;
    go(current);
    if (current !== target) raf = requestAnimationFrame(tick);
    else { raf = 0; last = 0; active = false; }
  };

  const onWheel = (e) => {
    if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    // Trang đang khoá cuộn (menu toàn màn hình đang mở)
    if (document.body.style.overflow === 'hidden') return;
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 40; else if (e.deltaMode === 2) dy *= window.innerHeight;
    if (nestedCanScroll(e.target, dy)) return;
    e.preventDefault();
    if (!active) { target = current = window.scrollY; active = true; }
    target = clamp(target + dy * speed);
    if (!raf) raf = requestAnimationFrame(tick);
  };

  // Trang cuộn bởi thứ khác (phím, thanh cuộn, link neo, scrollTo của trang): theo kịp, không giành lại.
  const onScroll = () => {
    if (!active) { target = current = window.scrollY; return; }
    if (Math.abs(window.scrollY - current) > 3) stop(); // trang tự cuộn chỗ khác (scrollTo, link neo) giữa lúc đang trôi
  };
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; active = false; target = current = window.scrollY; };
  const onKey = (e) => { if (active && /^(Arrow|Page|Home|End| )/.test(e.key)) stop(); };

  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('keydown', onKey);
  window.addEventListener('pointerdown', stop, { passive: true }); // bấm kéo thanh cuộn / chạm: dừng trôi
  window.addEventListener('resize', () => { target = clamp(target); });
  return () => {
    stop();
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('pointerdown', stop);
  };
}
