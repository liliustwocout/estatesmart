// Bong bóng thoại co lại vừa khít để các dòng dài gần bằng nhau, không còn 1–2 chữ rớt xuống dòng cuối.
// (text-wrap: balance chia dòng đều nhưng không thu hẹp khung, nên khung vẫn thừa chỗ bên phải.)
// Cách làm: giữ nguyên số dòng hiện có, tìm bề rộng nhỏ nhất mà vẫn đủ số dòng đó.
export function fitBalance(el) {
  if (!el || !el.isConnected) return;
  el.style.width = '';
  const cs = getComputedStyle(el);
  // Bề rộng bố cục chính xác tới phần lẻ pixel (không bị méo khi Mascot đang co giãn bằng scale,
  // không làm tròn xuống — làm tròn xuống 0,25 px cũng đủ đẩy chữ cuối rớt dòng).
  const full = parseFloat(cs.width);
  const h = el.offsetHeight;
  if (!full || !h) return;
  const lh = parseFloat(cs.lineHeight) || 20;
  const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
  if (h - pad < lh * 1.5) return; // một dòng: để nguyên
  let lo = full / 2, hi = full;
  for (let i = 0; i < 12 && hi - lo > 0.5; i++) {
    const mid = (lo + hi) / 2;
    el.style.width = mid + 'px';
    if (el.offsetHeight > h) lo = mid; else hi = mid;
  }
  el.style.width = Math.ceil(hi + 0.5) + 'px';
}

// Cân lại mọi phần tử khớp `selector` trên trang: lúc tải, khi font về, khi đổi cỡ cửa sổ, khi có bong bóng mới.
export function watchBalance(selector) {
  const run = () => document.querySelectorAll(selector).forEach(fitBalance);
  let raf = 0;
  const queue = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; run(); }); };
  queue();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(queue);
  window.addEventListener('resize', queue);
  new MutationObserver((list) => {
    for (const m of list) for (const n of m.addedNodes) {
      if (n.nodeType === 1 && (n.matches(selector) || n.querySelector(selector))) { queue(); return; }
    }
  }).observe(document.body, { childList: true, subtree: true });
}
