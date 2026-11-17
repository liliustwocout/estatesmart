// Hiện dần khi cuộn tới: gắn data-in cho mọi [data-reveal] khi phần tử vào màn hình (một lần).
// Không đụng className do React quản lý; phần tử mới (đổi hồ sơ, đổi bước) được tự theo dõi.
export function watchReveal(root = document.body) {
  const html = document.documentElement;
  html.classList.add('js');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const show = (el) => el.setAttribute('data-in', '');
  if (reduce || !('IntersectionObserver' in window)) {
    const all = () => root.querySelectorAll('[data-reveal]:not([data-in])').forEach(show);
    all();
    new MutationObserver(all).observe(root, { childList: true, subtree: true });
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      show(e.target);
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
  const seen = new WeakSet();
  const scan = () => root.querySelectorAll('[data-reveal]:not([data-in])').forEach((el) => {
    if (seen.has(el)) return;
    seen.add(el);
    io.observe(el);
  });
  scan();
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scan(); });
  }).observe(root, { childList: true, subtree: true });
}
