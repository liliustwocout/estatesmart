// Trang Trợ lý mặt bằng (/tro-ly/): chat bên trái, khung kết quả bên phải.
// Khung phải có 4 trạng thái: chờ → danh sách 3 mặt bằng → chi tiết (bản đồ 3D, ảnh) → báo cáo đầy đủ.
// Chuyển động theo hai đường cong: ease-layout (khung đẩy nhau, ảnh phóng to) và ease-reveal (nội dung hiện ra).
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Mascot from '../mascot/Mascot.jsx';
import Hunt from './Hunt.jsx';

const REDUCE = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const T = (ms) => (REDUCE ? 20 : ms);
// 5 AI Agent, hiện thành checklist khi đang thẩm định để người dùng đọc kịp từng bước.
const AGENTS = [
  { name: 'Phân tích nhu cầu', detail: 'Đọc mô hình, khu vực, ngân sách và diện tích' },
  { name: 'Sàng lọc mặt bằng', detail: 'Loại mặt bằng vượt ngân sách hoặc lệch diện tích' },
  { name: 'Đánh giá vị trí', detail: 'Chung cư, trường học, xe buýt trong 500 m' },
  { name: 'Phân tích cạnh tranh', detail: 'Cơ sở cùng ngành quanh từng mặt bằng' },
  { name: 'Chấm điểm và khuyến nghị', detail: 'Xếp hạng, chọn ba mặt bằng đáng xem nhất' }
];
const STEP_MS = 750;
const FOUND_MS = 1500; // Mascot giơ ghim “tìm thấy” trước khi hiện danh sách
const OOPS_MS = 2200;
const SUGGESTIONS = [
  'Mở quán cà phê ở Ocean Park, ngân sách khoảng 50 triệu/tháng, diện tích 150–250 m², cần chỗ đỗ ô tô',
  'Tìm mặt bằng trà sữa gần trường học, dưới 30 triệu/tháng',
  'Cửa hàng tiện lợi gần chung cư, diện tích 60–100 m², tầm 25 triệu'
];
const pad2 = (n) => String(n).padStart(2, '0');
const profileHref = (code) => '/mat-bang/?ma=' + encodeURIComponent(code);
let uid = 0;
const id = () => ++uid;

async function postJson(url, body, signal) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || 'Lỗi ' + res.status); e.status = res.status; throw e; }
  return data;
}
const later = (ms) => new Promise((r) => setTimeout(r, ms));
// Vị trí phần tử so với khung `base`, bỏ qua transform đang chạy (hàng danh sách có thể đang trượt).
const offRect = (el, base) => {
  let x = 0, y = 0, n = el;
  while (n && n !== base) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
  return { left: x, top: y, width: el.offsetWidth, height: el.offsetHeight };
};
// cubic-bezier(x1, y1, x2, y2) → hàm tiến độ, để tính sẵn từng khung hình cho Web Animations.
function bezier(x1, y1, x2, y2) {
  const at = (a, b, t) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
  return (x) => {
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 22; i++) { t = (lo + hi) / 2; if (at(x1, x2, t) < x) lo = t; else hi = t; }
    return at(y1, y2, t);
  };
}
const EASE_OPEN = bezier(0.65, 0, 0.15, 1); // tăng tốc dứt khoát, đáp rất êm
const EASE_CLOSE = bezier(0.5, 0, 0.2, 1);
const OPEN_MS = 640;
const CLOSE_MS = 540;
// Ảnh của hàng phóng thành khung bản đồ chỉ bằng transform (chạy trên GPU, không dàn trang lại mỗi khung hình).
// Khung zoom luôn đặt đúng vị trí bản đồ; mỗi khung hình tính scale của khung và scale bù của ảnh
// sao cho ảnh luôn “cover” đúng như object-fit ở kích thước trung gian, không méo, không giật ở hai đầu.
function zoomKeys(a, b, nw, nh, from, to, ease, fadeIn) {
  const kB = Math.max(b.width / nw, b.height / nh);
  const bcx = b.left + b.width / 2, bcy = b.top + b.height / 2;
  const acx = a.left + a.width / 2, acy = a.top + a.height / 2;
  const outer = [], inner = [], round = [];
  const N = 36;
  for (let j = 0; j <= N; j++) {
    const o = j / N;
    const t = from + (to - from) * ease(o);
    const w = a.width + (b.width - a.width) * t, h = a.height + (b.height - a.height) * t;
    const sx = w / b.width, sy = h / b.height;
    const k = Math.max(w / nw, h / nh);
    const r = 22 - 2 * t;
    const f = { offset: o, transform: `translate3d(${((acx - bcx) * (1 - t)).toFixed(2)}px, ${((acy - bcy) * (1 - t)).toFixed(2)}px, 0) scale(${sx.toFixed(5)}, ${sy.toFixed(5)})` };
    if (fadeIn) f.opacity = Math.min(1, o / 0.18);
    outer.push(f);
    inner.push({ offset: o, transform: `scale(${(k / (kB * sx)).toFixed(5)}, ${(k / (kB * sy)).toFixed(5)})` });
    round.push({ offset: o, borderRadius: `${(r / sx).toFixed(2)}px / ${(r / sy).toFixed(2)}px` });
  }
  return { outer, inner, round };
}

// Số chạy từ 0 lên giá trị thật khi `run` bật.
function CountUp({ to, run = true, ms = 900, delay = 0 }) {
  const n = Number(to);
  const dec = Number.isFinite(n) && !Number.isInteger(n) ? 1 : 0;
  const [v, setV] = useState(run && !REDUCE ? 0 : n);
  useEffect(() => {
    if (!Number.isFinite(n)) return undefined;
    if (!run || REDUCE) { setV(n); return undefined; }
    let raf = 0, t0 = 0;
    const tick = (t) => {
      if (!t0) t0 = t;
      const p = Math.min(1, Math.max(0, (t - t0 - delay) / ms));
      setV(n * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setV(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [n, run]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!Number.isFinite(n)) return <>{to}</>;
  return <>{v.toLocaleString('vi-VN', { minimumFractionDigits: dec, maximumFractionDigits: dec })}</>;
}
const Dots = ({ cls = 'dots' }) => <span className={cls} aria-hidden="true"><i /><i /><i /></span>;

/* ---------------- Cột chat ---------------- */

function Bubble({ m, onPick, active, onAsk, onShare }) {
  if (m.k === 'user') return <div className="b-user es-up">{m.text}</div>;
  if (m.k === 'agents') {
    return (
      <div className={'b-agents es-up' + (m.done ? ' is-done' : '')} role="status">
        <p className="ag-title">{m.done ? 'Đội ngũ đã thẩm định xong' : m.reading ? 'Đang đọc nhu cầu của anh/chị' : 'Đội ngũ đang thẩm định'}{!m.done && <Dots />}</p>
        <span className="ag-bar" aria-hidden="true"><i style={{ transform: `scaleX(${m.done ? 1 : m.reading ? 0.06 : (m.step + 0.6) / AGENTS.length})` }} /></span>
        <ol>
          {AGENTS.map((a, i) => {
            const st = m.done || i < m.step ? 'done' : i === m.step && !m.reading ? 'run' : 'wait';
            return (
              <li key={a.name} className={st} style={{ '--i': i }}>
                <span className="ag-ico" aria-hidden="true">
                  {st === 'done' ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="m2.5 6.2 2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
                </span>
                <span className="ag-text">
                  <b>{a.name}</b>
                  <small>{(m.facts && m.facts[i]) || a.detail}</small>
                </span>
                <span className="sr-only">{st === 'done' ? 'Xong' : st === 'run' ? 'Đang xử lý' : 'Chờ'}</span>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }
  if (m.k === 'thinking') return <div className="b-bot thinking es-up" role="status"><span className="m-tile" aria-hidden="true"><Mascot pose="02-chay-tim" size={30} /></span><span>{m.text}</span><Dots /></div>;
  if (m.k === 'ask') {
    return (
      <div className="b-group es-up">
        <div className="b-bot">{m.text}</div>
        {m.open && <div className="chips">{m.options.map((o, i) => <button key={o} type="button" className="chip es-up" style={{ animationDelay: i * 60 + 'ms' }} onClick={() => onAsk(o)}>{o}</button>)}</div>}
      </div>
    );
  }
  if (m.k === 'results') {
    return (
      <div className="b-results es-up">
        <p>{m.text}</p>
        {m.rows.map((r, i) => (
          <button key={r.code} type="button" className={'mini es-up' + (active === i ? ' is-on' : '')} style={{ animationDelay: 120 + i * 80 + 'ms' }} onClick={() => onPick(i)} aria-label={`Mở ${r.name}, ${r.score} điểm`}>
            <span className="mi-idx">{pad2(i + 1)}</span>
            <span className="mi-name">{r.name.split(',')[0]}, {r.name.split(',').slice(1).join(',').trim()}</span>
            <span className="mi-price">{Math.round(r.rentM)} tr</span>
            <span className="mi-score"><CountUp to={r.score} delay={200 + i * 80} /></span>
          </button>
        ))}
        {onShare && <button type="button" className="share-b" onClick={onShare}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6.5 9.5 9.5 6.5M7 4.5l1-1a2.8 2.8 0 0 1 4 4l-1 1M9 11.5l-1 1a2.8 2.8 0 0 1-4-4l1-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>Chia sẻ kết quả</button>}
      </div>
    );
  }
  if (m.k === 'sum') {
    return (
      <div className="b-sum es-up">
        <p className="lbl">Đang xem {pad2(m.i + 1)}</p>
        <p className="sum-name">{m.name}</p>
        <p className="sum-line">{m.score}/100 · {m.price} · {m.area} m²</p>
        {m.risk && <p className="sum-risk">Rủi ro chính: {m.risk}</p>}
      </div>
    );
  }
  if (m.mood === 'oops') return <div className="b-bot oops es-up"><span className="m-tile" aria-hidden="true"><Mascot pose="12-boi-roi" size={30} /></span><span>{m.text}</span></div>;
  return <div className={'b-bot es-up' + (m.streaming ? ' streaming' : '')}>{m.text}</div>;
}

/* ---------------- Khung phải: báo cáo ---------------- */

// Gửi lời nhắn cho chủ nhà: cần họ tên, số điện thoại và đồng ý; đội ngũ nhận qua trang quản trị và Telegram.
function ContactCard({ r, msg, setMsg, onCopy }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', phone: '', consent: false, website: '' });
  const [err, setErr] = useState({});
  const [state, setState] = useState('idle'); // idle | sending | sent
  useEffect(() => { setOpen(false); setState('idle'); setErr({}); }, [r.code]);
  const set = (k, v) => { setF((s) => ({ ...s, [k]: v })); if (err[k]) setErr((e) => { const n = { ...e }; delete n[k]; return n; }); };
  const submit = async (e) => {
    e.preventDefault();
    if (!open) { setOpen(true); return; }
    const e2 = {};
    if (f.name.trim().length < 2) e2.name = 'Nhập họ và tên.';
    if (!/^0\d{9}$/.test(f.phone.replace(/[\s.\-()]/g, '').replace(/^\+84/, '0'))) e2.phone = 'Số điện thoại cần đủ 10 chữ số.';
    if (!f.consent) e2.consent = 'Cần đồng ý để đội ngũ liên hệ lại.';
    if (Object.keys(e2).length) { setErr(e2); return; }
    setState('sending');
    try {
      await postJson('/api/leads', { code: r.code, name: f.name, phone: f.phone, consent: f.consent, website: f.website, message: msg, source: 'owner_msg', role: 'Chủ doanh nghiệp' });
      setState('sent');
    } catch (ex) {
      setState('idle');
      setErr({ _: ex.message || 'Chưa gửi được, anh/chị thử lại sau.' });
    }
  };
  if (state === 'sent') {
    return (
      <section className="card c-contact" style={{ '--i': 4 }}>
        <h3>Liên hệ chủ nhà</h3>
        <p className="sent-ok" role="status"><span aria-hidden="true">✓</span> Đã gửi lời nhắn về {r.code}. Đội ngũ estateSmartAI sẽ liên hệ chủ nhà và gọi lại cho anh/chị để hẹn lịch xem.</p>
        <p className="sent">Bản thử nghiệm: thông tin mặt bằng là dữ liệu mô phỏng, đội ngũ sẽ xác nhận lại khi gọi.</p>
        <a className="full-link" href={profileHref(r.code)}>Mở hồ sơ để in hoặc tải PDF</a>
      </section>
    );
  }
  return (
    <form className="card c-contact" style={{ '--i': 4 }} onSubmit={submit} noValidate>
      <h3>Liên hệ chủ nhà</h3>
      <label className="sr-only" htmlFor="owner-msg">Tin nhắn gửi chủ nhà</label>
      <textarea id="owner-msg" value={msg} onChange={(e) => setMsg(e.target.value)} rows={open ? 3 : 5} maxLength={1000} />
      {open && (
        <div className="c-fields es-up">
          <div>
            <label htmlFor="oc-name">Họ và tên</label>
            <input id="oc-name" value={f.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" aria-invalid={err.name ? 'true' : 'false'} />
            {err.name && <p className="c-err">{err.name}</p>}
          </div>
          <div>
            <label htmlFor="oc-phone">Số điện thoại</label>
            <input id="oc-phone" type="tel" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" placeholder="0901 234 567" aria-invalid={err.phone ? 'true' : 'false'} />
            {err.phone && <p className="c-err">{err.phone}</p>}
          </div>
          <label className="c-consent"><input type="checkbox" checked={f.consent} onChange={(e) => set('consent', e.target.checked)} />Tôi đồng ý để estateSmartAI lưu họ tên, số điện thoại và liên hệ lại về mặt bằng này.</label>
          {err.consent && <p className="c-err">{err.consent}</p>}
          <input className="trap" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={(e) => set('website', e.target.value)} />
        </div>
      )}
      {err._ && <p className="c-err" role="alert">{err._}</p>}
      <div className="c-actions">
        <button type="submit" className={'btn-light' + (state === 'sending' ? ' is-loading' : '')} disabled={state === 'sending'} aria-busy={state === 'sending'}>
          {state === 'sending' ? <>Đang gửi<Dots /></> : open ? 'Gửi lời nhắn' : 'Gửi cho chủ nhà'}
        </button>
        <button type="button" className="btn-ghost-d" onClick={onCopy}>Sao chép</button>
      </div>
      <a className="full-link" href={profileHref(r.code)}>Mở hồ sơ để in hoặc tải PDF</a>
    </form>
  );
}

function ReportGrid({ r, open, onCopy, msg, setMsg }) {
  if (!r) {
    return (
      <div className="rgrid skel" aria-busy="true">
        <span className="sr-only">Đang tải báo cáo…</span>
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className={'card sk' + (i === 0 ? ' c-comp' : '')} style={{ '--i': i }}><i /><i /><i /></div>)}
      </div>
    );
  }
  const t = r.traffic;
  const max = Math.max(r.rentCompare.mine, r.rentCompare.median) * 1.08;
  return (
    <div className="rgrid">
      <section className="card c-comp" style={{ '--i': 0 }}>
        <header><h3>Đối thủ cùng ngành trong {r.compRadius} m</h3><span className="big comp"><CountUp to={r.compCount} run={open} delay={250} /></span></header>
        {r.competitors.length ? (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Cửa hàng</th><th>Loại</th><th className="num">Cách</th><th>Nguồn</th></tr></thead>
              <tbody>{r.competitors.map((c, i) => <tr key={i} style={{ '--i': i }}><td>{c.name}</td><td>{c.kind}</td><td className="num">{c.dText}</td><td>{c.source}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <p className="empty">Chưa có cơ sở cùng ngành nào trong {r.compRadius} m trên OpenStreetMap.</p>}
        <p className="read"><i className="dot good" />{r.compNote}</p>
      </section>

      <section className="card c-traffic" style={{ '--i': 1 }}>
        <header><h3>Lưu lượng theo giờ</h3><span className="tag">Ước lượng</span></header>
        <div className="bars" role="img" aria-label={'Lưu lượng ước lượng: ' + t.bars.map((b) => b.label + ' ' + b.v + '%').join(', ')}>
          {t.bars.map((b, i) => (
            <div key={b.label} className={'bar-col' + (i === t.peak ? ' is-peak' : '')} style={{ '--i': i }} title={i === t.peak ? 'Giờ cao điểm' : undefined}>
              <span className={'bar' + (i === t.peak ? ' peak' : '')} style={{ height: Math.max(6, b.v) + '%' }} />
              <span className="bar-l">{b.label}</span>
            </div>
          ))}
        </div>
        <p className="read">{t.text}</p>
        <p className="src">Ước lượng từ loại tiện ích xung quanh (OpenStreetMap), không phải số đo thực tế.</p>
      </section>

      <section className="card c-rent" style={{ '--i': 2 }}>
        <h3>Giá thuê so với khu vực</h3>
        <div className="cmp">
          <div className="cmp-row"><span>Mặt bằng này</span><b><CountUp to={r.rentCompare.mine} run={open} delay={300} /> triệu/tháng</b></div>
          <span className="track"><span className="fill mine" style={{ width: (r.rentCompare.mine / max) * 100 + '%' }} /></span>
          <div className="cmp-row muted"><span>Trung vị khu vực</span><b><CountUp to={r.rentCompare.median} run={open} delay={450} /> triệu/tháng</b></div>
          <span className="track"><span className="fill med" style={{ width: (r.rentCompare.median / max) * 100 + '%' }} /></span>
        </div>
        <p className="read">{r.rentCompare.diff === 0 ? 'Ngang mức chung.' : r.rentCompare.diff > 0 ? `Cao hơn mức chung khoảng ${r.rentCompare.diff}%.` : `Thấp hơn mức chung khoảng ${-r.rentCompare.diff}%.`}</p>
        <p className="src">Quy đổi theo diện tích, so với {r.rentCompare.n} {r.rentCompare.typeLabel} trong hệ thống (dữ liệu mô phỏng).</p>
      </section>

      <section className="card c-access" style={{ '--i': 3 }}>
        <h3>Tiếp cận và đỗ xe</h3>
        <dl>{r.access.map((a, i) => <div key={a.label} className={a.warn ? 'warn' : ''} style={{ '--i': i }}><dt>{a.label}</dt><dd>{a.value}</dd></div>)}</dl>
      </section>

      <ContactCard r={r} msg={msg} setMsg={setMsg} onCopy={onCopy} />
    </div>
  );
}

/* ---------------- Trang ---------------- */

export default function Assistant() {
  const [msgs, setMsgs] = useState(() => [{ id: id(), k: 'bot', text: 'Chào bạn, mình là trợ lý mặt bằng. Hãy mô tả mô hình kinh doanh, khu vực và ngân sách trong một câu, hoặc chọn một câu gợi ý bên dưới.' }]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false); // đang thẩm định hoặc đang trả lời
  const [criteria, setCriteria] = useState(null); // tiêu chí đang gom (chưa đủ)
  const [final, setFinal] = useState(null); // tiêu chí đã dùng để thẩm định
  const [recs, setRecs] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | list | zin (đang phóng ảnh) | detail | zout (đang thu về)
  const [sel, setSel] = useState(0);
  const [view, setView] = useState(-1); // -1 bản đồ, 0..n ảnh
  const [reportOpen, setReportOpen] = useState(false);
  const [reports, setReports] = useState({});
  const [toggles, setToggles] = useState({ mine: true, comp: true, cust: true, links: true });
  const [ownerMsg, setOwnerMsg] = useState('');
  const [shareId, setShareId] = useState(null);
  const [toast, setToast] = useState(null);
  const [entered, setEntered] = useState(REDUCE);
  const [hunt, setHunt] = useState(null); // Mascot chạy tìm ở khung phải, xem Hunt.jsx
  const [idleSay, setIdleSay] = useState(false); // Mascot ở màn chờ bắt đầu nói sau khi trang đã vào

  const stageRef = useRef(null);
  const rowImgRefs = useRef([]);
  const mapSlotRef = useRef(null);
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const zoomRef = useRef(null);
  const zoomImgRef = useRef(null);
  const zoomAnims = useRef([]);
  const moving = useRef(false); // đang chạy chuyển cảnh: bỏ qua bấm chồng
  const threadRef = useRef(null);
  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const askCtrl = useRef(null);
  const session = useRef(0);
  const toastTimer = useRef(null);

  const cur = recs ? recs[sel] : null;
  const rep = cur ? reports[cur.code] : null;
  const detail = phase === 'detail';

  useEffect(() => { const t = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true))); return () => cancelAnimationFrame(t); }, []);
  useEffect(() => { const t = setTimeout(() => setIdleSay(true), T(1500)); return () => clearTimeout(t); }, []);
  useEffect(() => {
    if (!recs || !final) return;
    try { sessionStorage.setItem('es-recs', JSON.stringify({ codes: recs.map((r) => r.code), criteria: final })); } catch (e) { /* bỏ qua */ }
  }, [recs, final]);
  useLayoutEffect(() => { const el = threadRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs]);
  useEffect(() => () => { if (askCtrl.current) askCtrl.current.abort(); if (mapRef.current) mapRef.current.destroy(); }, []);

  const push = (m) => setMsgs((s) => [...s, { id: id(), ...m }]);
  const showToast = (text, action) => { setToast({ text, action }); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 5000); };

  // ---- Bản đồ 3D: nạp khi lần đầu cần, cập nhật theo mặt bằng đang xem ----
  const ensureMap = useCallback(async () => {
    if (mapRef.current || !mapElRef.current) return;
    try {
      const m = await import('./map3d.js');
      if (!mapRef.current && mapElRef.current) mapRef.current = m.createMap3D(mapElRef.current);
    } catch (e) { /* mạng chặn bản đồ: vẫn còn ảnh và báo cáo */ }
  }, []);
  useEffect(() => {
    if (!mapRef.current) return;
    if (detail && rep) mapRef.current.update(rep);
  }, [detail, rep]);
  useEffect(() => { if (mapRef.current) Object.entries(toggles).forEach(([k, v]) => mapRef.current.toggle(k, v)); }, [toggles]);
  useEffect(() => { if (detail && mapRef.current) mapRef.current.resize(); }, [detail]);
  useEffect(() => { if (rep) setOwnerMsg(rep.message); }, [rep]);

  const loadReport = useCallback(async (code, crit) => {
    if (reports[code]) return reports[code];
    try {
      const r = await postJson('/api/report', { code, criteria: crit });
      setReports((s) => ({ ...s, [code]: r }));
      return r;
    } catch (e) { return null; }
  }, [reports]);

  // ---- Thẩm định: đọc câu tự do → hỏi thêm nếu thiếu → 5 Agent → danh sách ----
  const runSearch = async (text) => {
    const my = ++session.current;
    setBusy(true);
    push({ k: 'user', text });
    const agId = id();
    setMsgs((s) => [...s.map((m) => (m.k === 'ask' ? { ...m, open: false } : m)), { id: agId, k: 'agents', step: 0, reading: true }]);
    const setAg = (patch) => setMsgs((s) => s.map((m) => (m.id === agId ? { ...m, ...patch } : m)));
    const dropAg = () => setMsgs((s) => s.filter((m) => m.id !== agId));
    // Mascot rời khung phải: thu nhỏ về góc rồi biến mất
    const leave = (wait = 0) => later(T(wait)).then(() => {
      if (my !== session.current) return;
      setHunt((h) => (h ? { ...h, mode: 'leave' } : h));
      later(T(600)).then(() => { if (my === session.current) setHunt((h) => (h && h.mode === 'leave' ? null : h)); });
    });
    setHunt({ mode: 'read', step: 0 });
    // Màn hình hẹp (khung kết quả nằm dưới chat): lướt xuống xem đội ngũ làm việc, xong thì lướt về khung chat.
    const narrow = window.innerWidth <= 980;
    const glide = (el, wait = 0) => later(T(wait)).then(() => {
      if (!narrow || my !== session.current || !el) return;
      el.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'start' });
    });
    if (narrow) { inputRef.current?.blur(); glide(stageRef.current, 120); } // đóng bàn phím rồi mới lướt
    let stopped = false; // máy chủ lỗi: dừng đếm bước, không để bước sau đè lên trạng thái lỗi
    try {
      const parsed = await postJson('/api/parse', { text, prev: criteria || {} });
      if (my !== session.current) return;
      if (parsed.ask) {
        setCriteria(parsed.criteria);
        dropAg();
        leave();
        glide(chatRef.current, 500);
        push({ k: 'ask', text: parsed.ask.q, options: parsed.ask.options, open: true });
        setBusy(false);
        return;
      }
      const crit = parsed.criteria;
      const need = [crit.model, crit.area, crit.budget && 'ngân sách ' + crit.budget.charAt(0).toLowerCase() + crit.budget.slice(1), crit.size].filter(Boolean).join(', ');
      setAg({ reading: false, step: 0, facts: [need || null] });
      setHunt({ mode: 'run', step: 0 });
      // Mỗi bước giữ ít nhất STEP_MS để người dùng kịp đọc; bước cuối chờ máy chủ trả kết quả.
      const stepping = (async () => { for (let i = 1; i < AGENTS.length; i++) { await later(T(STEP_MS)); if (stopped || my !== session.current) return; setAg({ step: i }); setHunt({ mode: 'run', step: i }); } await later(T(STEP_MS)); })();
      const [data] = await Promise.all([postJson('/api/recommend', { criteria: crit }), stepping]);
      if (my !== session.current) return;
      const top = data.results[0];
      setAg({ done: true, step: AGENTS.length, facts: [
        need || null,
        `Còn ${data.stats.fit} trên ${data.stats.total} mặt bằng phù hợp`,
        null,
        `${data.competitors.length} cơ sở cùng ngành quanh ba mặt bằng (OpenStreetMap)`,
        top ? `Cao nhất ${top.score}/100: ${top.name.split(',')[0]}` : null
      ] });
      const rows = data.results.map((r) => ({ ...r, rentM: parseFloat(String(r.price).replace(/\./g, '').replace(',', '.')) }));
      setCriteria(null);
      setFinal(crit);
      setRecs(rows);
      setReports({});
      setShareId(null);
      data.notes.forEach((n) => push({ k: 'bot', text: n }));
      push({ k: 'results', text: `Đội ngũ đã rà soát ${data.stats.total} mặt bằng trong hệ thống, ${data.stats.fit} vừa ngân sách và diện tích. Đây là ba lựa chọn đáng đi xem nhất:`, rows });
      setSel(0);
      setView(-1);
      rows.forEach((r) => postJson('/api/report', { code: r.code, criteria: crit }).then((rp) => setReports((s) => ({ ...s, [r.code]: rp }))).catch(() => {}));
      ensureMap();
      setHunt({ mode: 'found', step: AGENTS.length - 1 });
      await later(T(FOUND_MS));
      if (my !== session.current) return;
      setPhase('list');
      leave();
      glide(chatRef.current, 700); // kịp thấy danh sách hiện ra rồi về khung chat đọc kết quả
    } catch (e) {
      stopped = true;
      if (my !== session.current) return;
      dropAg();
      push({ k: 'bot', mood: 'oops', text: e.status === 429 ? e.message : 'Chưa kết nối được máy chủ thẩm định. Anh/chị thử lại sau ít phút.' });
      setHunt({ mode: 'oops', step: 0 });
      leave(OOPS_MS);
      glide(chatRef.current, OOPS_MS);
    } finally {
      if (my === session.current) setBusy(false);
    }
  };

  // ---- Chia sẻ: lưu phiên trên máy chủ, sao chép link /tro-ly/?phien=… ----
  const share = async () => {
    if (!recs) return;
    try {
      const sid = shareId || (await postJson('/api/share', { criteria: final || {}, codes: recs.map((r) => r.code) })).id;
      setShareId(sid);
      const link = location.origin + '/tro-ly/?phien=' + sid;
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: 'Ba mặt bằng phù hợp — estateSmartAI', url: link }).catch(() => {});
      } else {
        await navigator.clipboard.writeText(link);
        showToast('Đã sao chép link chia sẻ. Link mở lại đúng ba mặt bằng này trong 90 ngày.');
      }
    } catch (e) { showToast('Chưa tạo được link chia sẻ, anh/chị thử lại sau.'); }
  };

  // Mở link chia sẻ: dựng lại kết quả đã lưu.
  useEffect(() => {
    let sid = '';
    try { sid = new URLSearchParams(location.search).get('phien') || ''; } catch (e) { sid = ''; }
    if (!/^[A-Za-z0-9]{6,20}$/.test(sid)) return;
    (async () => {
      try {
        const res = await fetch('/api/share/' + sid);
        const d = await res.json();
        if (!res.ok || !d.results || !d.results.length) throw new Error(d.error || 'Không mở được link');
        const rows = d.results.map((r) => ({ ...r, rentM: parseFloat(String(r.price).replace(/\./g, '').replace(',', '.')) }));
        const c = d.criteria || {};
        const need = [c.model, c.area, c.budget && 'ngân sách ' + c.budget, c.size].filter(Boolean).join(', ');
        setFinal(c); setRecs(rows); setShareId(sid); setReports({});
        setMsgs((s) => [...s,
          { id: id(), k: 'bot', text: 'Đây là kết quả tư vấn được chia sẻ' + (need ? ' cho nhu cầu: ' + need : '') + '. Số liệu được tính lại theo dữ liệu hiện tại.' },
          { id: id(), k: 'results', text: 'Ba mặt bằng trong kết quả này:', rows }
        ]);
        setPhase('list');
        rows.forEach((r) => postJson('/api/report', { code: r.code, criteria: c }).then((rp) => setReports((x) => ({ ...x, [r.code]: rp }))).catch(() => {}));
        ensureMap();
      } catch (e) {
        setMsgs((s) => [...s, { id: id(), k: 'bot', text: 'Link chia sẻ đã hết hạn hoặc không còn. Anh/chị mô tả nhu cầu để tư vấn lại nhé.' }]);
      }
    })();
  }, []);

  // ---- Hỏi tự do sau khi có kết quả: trợ lý AI trả lời dần từng đoạn ----
  const askAI = async (question) => {
    const prior = msgs.filter((m) => m.role && m.text).map((m) => ({ role: m.role, content: m.text }));
    const ctrl = new AbortController();
    askCtrl.current = ctrl;
    setBusy(true);
    const botId = id();
    setMsgs((s) => [...s, { id: id(), k: 'user', role: 'user', text: question }, { id: botId, k: 'thinking', text: 'Đang xem lại dữ liệu…' }]);
    const set = (patch) => setMsgs((s) => s.map((m) => (m.id === botId ? { ...m, ...patch } : m)));
    const fail = 'Hiện chưa kết nối được trợ lý AI. Anh/chị có thể mở từng mặt bằng để xem bản đồ, hình ảnh và báo cáo.';
    let text = '';
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctrl.signal, body: JSON.stringify({ message: question, criteria: final || {}, history: prior, codes: (recs || []).map((r) => r.code) }) });
      if (!res.ok || !res.body) { const err = await res.json().catch(() => ({})); set({ k: 'bot', role: 'assistant', text: err.error || fail }); return; }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const ev = buf.slice(0, i);
          buf = buf.slice(i + 2);
          if (!ev.startsWith('data:')) continue;
          let d;
          try { d = JSON.parse(ev.slice(5)); } catch (e) { continue; }
          if (d.delta) { text += d.delta; set({ k: 'bot', role: 'assistant', streaming: true, text: text.replace(/\*\*|^#+\s*/gm, '') }); }
          if (d.error) { text += (text ? '\n\n' : '') + d.error; set({ k: 'bot', role: 'assistant', text }); }
        }
      }
      set({ k: 'bot', role: 'assistant', streaming: false, text: text.replace(/\*\*|^#+\s*/gm, '') || fail });
    } catch (e) {
      if (e.name !== 'AbortError') set({ k: 'bot', role: 'assistant', streaming: false, text: text || fail });
    } finally {
      if (askCtrl.current === ctrl) { askCtrl.current = null; setBusy(false); }
    }
  };

  const send = (raw) => {
    const t = String(raw ?? draft).trim();
    if (!t || busy) { if (!t) inputRef.current?.focus(); return; }
    setDraft('');
    if (recs && !criteria) askAI(t); else runSearch(t);
  };

  // ---- Chuyển cảnh: ảnh của dòng phóng thành khung bản đồ, và ngược lại (zoomKeys ở đầu file) ----
  const stopZoom = () => { zoomAnims.current.forEach((a) => a.cancel()); zoomAnims.current = []; };
  const hideZoom = (fade) => {
    const el = zoomRef.current;
    if (!el) return;
    if (!fade || REDUCE) { stopZoom(); el.style.display = 'none'; return; }
    const f = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: 'ease-out', fill: 'forwards' });
    zoomAnims.current.push(f);
    f.onfinish = () => { stopZoom(); el.style.display = 'none'; };
  };
  // dir 1: hàng → bản đồ; dir -1: bản đồ → hàng. Trả về khi chuyển động xong.
  const runZoom = (i, dir) => new Promise((resolve) => {
    const st = stageRef.current, el = zoomRef.current, img = zoomImgRef.current;
    const cell = rowImgRefs.current[i], slot = mapSlotRef.current;
    stopZoom();
    if (!st || !el || !img || !cell || !slot || !el.animate || REDUCE) { if (el) el.style.display = 'none'; resolve(); return; }
    const a = offRect(cell, st), b = offRect(slot, st);
    const pic = cell.querySelector('img');
    const nw = (pic && pic.naturalWidth) || b.width, nh = (pic && pic.naturalHeight) || b.height;
    if (pic && img.getAttribute('src') !== pic.getAttribute('src')) img.src = pic.getAttribute('src');
    Object.assign(el.style, { display: 'block', left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', height: b.height + 'px', opacity: '' });
    const k = dir > 0 ? zoomKeys(a, b, nw, nh, 0, 1, EASE_OPEN, false) : zoomKeys(a, b, nw, nh, 1, 0, EASE_CLOSE, true);
    const opt = { duration: dir > 0 ? OPEN_MS : CLOSE_MS, easing: 'linear', fill: 'both' };
    const list = [el.animate(k.outer, opt), img.animate(k.inner, opt), el.animate(k.round, opt)];
    zoomAnims.current = list;
    let done = false;
    const end = () => { if (!done) { done = true; resolve(); } };
    list[0].onfinish = end;
    list[0].oncancel = end;
  });

  const open = async (i) => {
    if (!recs || moving.current) return;
    if (phase === 'detail' && sel === i) return;
    if (phase === 'detail') await back();
    else if (phase !== 'list') return;
    moving.current = true;
    const my = session.current;
    ensureMap();
    loadReport(recs[i].code, final);
    // Màn hình hẹp: khung kết quả nằm dưới chat, cuộn tới trước khi phóng ảnh.
    if (window.innerWidth <= 980 && stageRef.current) {
      stageRef.current.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'start' });
      await later(T(420));
    }
    setSel(i);
    setView(-1);
    setPhase('zin');
    await runZoom(i, 1);
    if (my !== session.current) { moving.current = false; return; }
    setPhase((p) => (p === 'zin' ? 'detail' : p));
    // Ảnh phủ thêm một nhịp cho bản đồ kịp hiện, rồi mờ đi để lộ bản đồ 3D bên dưới
    setTimeout(() => { if (my === session.current) hideZoom(true); }, T(260));
    moving.current = false;
    const r = recs[i];
    const rp = reports[r.code];
    push({ k: 'sum', i, name: r.name, score: r.score, price: r.price, area: r.size.replace(' m²', ''), risk: (rp && rp.mainRisk) || (r.cons && r.cons[0]) || null });
  };
  const back = async () => {
    if (phase !== 'detail' || moving.current) return;
    moving.current = true;
    const my = session.current;
    if (reportOpen) { setReportOpen(false); await later(T(260)); } // báo cáo trượt xuống trước
    setPhase('zout');
    await runZoom(sel, -1);
    if (my !== session.current) { moving.current = false; return; }
    setPhase((p) => (p === 'zout' ? 'list' : p));
    setView(-1);
    // Đợi ảnh thật của hàng hiện lại rồi mới gỡ ảnh zoom, để không chớp
    requestAnimationFrame(() => requestAnimationFrame(() => hideZoom(false)));
    moving.current = false;
  };

  const reset = () => {
    const snap = { msgs, recs, phase: phase === 'detail' || phase === 'list' ? phase : recs ? 'list' : 'idle', sel, final, reports, criteria };
    session.current++;
    if (askCtrl.current) askCtrl.current.abort();
    setBusy(false);
    setMsgs([{ id: id(), k: 'bot', text: 'Mình bắt đầu phiên mới. Anh/chị mô tả nhu cầu trong một câu nhé.' }]);
    setRecs(null); setFinal(null); setCriteria(null); setPhase('idle'); setReportOpen(false); setView(-1); setHunt(null);
    moving.current = false; hideZoom(false);
    if (mapRef.current) mapRef.current.update(null);
    showToast('Đã bắt đầu phiên mới.', { label: 'Hoàn tác', run: () => { setMsgs(snap.msgs); setRecs(snap.recs); setFinal(snap.final); setReports(snap.reports); setCriteria(snap.criteria); setSel(snap.sel); setPhase(snap.phase === 'detail' ? 'list' : snap.phase); setToast(null); } });
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || !detail) return;
      e.preventDefault();
      if (reportOpen) setReportOpen(false); else back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---- Giá trị hiển thị ----
  const shown = phase === 'zin' || phase === 'detail'; // phần chi tiết hiện dần ngay trong lúc ảnh đang phóng
  const listShown = phase === 'list' || phase === 'zout';
  const activeIdx = shown ? sel : -1;
  const thinking = busy;
  const talking = msgs.some((m) => m.streaming);
  const sheetOpen = detail && reportOpen;
  const thumbs = useMemo(() => [{ label: 'Bản đồ 3D', v: -1 }, ...((rep && rep.photos) || []).map((p, j) => ({ ...p, v: j }))], [rep]);
  // Hiện: chậm rãi, có trễ theo thứ tự. Ẩn: nhanh, không trễ, để chuyển cảnh không phải chờ.
  const reveal = (on, delay = 0, off = 'translateY(12px)') => (on
    ? { opacity: 1, transform: 'none', transitionDelay: delay + 's' }
    : { opacity: 0, transform: off, pointerEvents: 'none', transitionDelay: '0s', transitionDuration: '.22s' });
  const idleLine = !idleSay || busy || hunt ? null : draft.trim() ? 'Nghe hay đấy! Bấm gửi là mình đi tìm.' : 'Gõ nhu cầu bên trái, mình đi tìm ngay!';

  return (
    <div className={'as-page' + (entered ? ' in' : '')}>
      <header className="as-top">
        <a className="as-brand" href="/">
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden="true"><g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.4 4H7a3 3 0 0 0-3 3v18a3 3 0 0 0 3 3h1.6" /><path d="M23.4 4H25a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H14.6" /><path d="M11.2 29.5 20.8 2.5" /></g><circle cx="21.6" cy="20.6" r="2.6" fill="#A3562B" /></svg>
          estateSmart / AI
        </a>
        <a className="as-home" href="/">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13 8H3.5m0 0L7.5 4m-4 4 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Trang chủ
        </a>
      </header>

      <div className="as-main">
        {/* ---------- CHAT ---------- */}
        <aside className="as-chat" ref={chatRef} aria-label="Trợ lý mặt bằng">
          <header className="ch-head">
            <span className={'robot' + (thinking && !talking ? ' is-thinking' : '')} aria-hidden="true">
              <Mascot pose={talking ? 'avatar-noi' : 'avatar'} size={30} follow />
            </span>
            <div className="ch-title">
              <h1>Trợ lý mặt bằng</h1>
              <p><i className={'live' + (busy ? ' busy' : '')} aria-hidden="true" />{busy ? (talking ? 'Đang trả lời' : 'Đội ngũ đang làm việc') : 'Đội ngũ 5 chuyên viên AI đang trực tuyến'}</p>
            </div>
            <button type="button" className="ch-x" onClick={reset} aria-label="Bắt đầu phiên mới">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3.5 3.5 9 9m0-9-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
          </header>
          <div className="ch-thread" ref={threadRef} role="log" aria-live="polite" aria-label="Hội thoại">
            {msgs.map((m) => <Bubble key={m.id} m={m} onPick={open} active={activeIdx} onAsk={(o) => send(o)} onShare={recs ? share : null} />)}
            {!recs && !criteria && msgs.length <= 2 && !busy && (
              <div className="sugg">
                <p className="sugg-l es-up" style={{ animationDelay: '.6s' }}>Thử một câu mẫu</p>
                {SUGGESTIONS.map((s, i) => (
                  <button key={s} type="button" className="sugg-b es-up" style={{ animationDelay: 0.7 + i * 0.09 + 's' }} onClick={() => send(s)}>
                    <span>{s}</span>
                    <svg className="sugg-arr" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h9.5m0 0L8.5 4m4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                ))}
              </div>
            )}
          </div>
          <form className={'ch-input' + (busy ? ' is-busy' : '')} onSubmit={(e) => { e.preventDefault(); send(); }}>
            <label htmlFor="as-input" className="sr-only">Mô tả nhu cầu hoặc đặt câu hỏi</label>
            <input id="as-input" ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} autoComplete="off" maxLength={500}
              placeholder={recs && !criteria ? (busy ? 'Trợ lý đang trả lời…' : 'Hỏi thêm về ba mặt bằng…') : 'Mô tả mô hình, khu vực, ngân sách…'} />
            <button type="submit" className={'send' + (busy ? ' is-busy' : draft.trim() ? ' ready' : ' dim')} aria-label={busy ? 'Đang xử lý' : 'Gửi'} aria-busy={busy}>
              {busy ? <Dots cls="send-dots" /> : <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 13V3.5m0 0L4 7.5m4-4 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </button>
          </form>
          {recs && <p className="ch-note">Câu hỏi được gửi tới mô hình AI bên thứ ba, đừng nhập thông tin cá nhân. Số liệu mặt bằng là dữ liệu minh hoạ.</p>}
        </aside>

        {/* ---------- KHUNG PHẢI ---------- */}
        <section className="as-stage" ref={stageRef} aria-label="Kết quả thẩm định">
          {/* Chờ */}
          <div className={'st-idle' + (phase === 'idle' ? '' : ' gone')} aria-hidden={phase !== 'idle'}>
            <img src="/images/hero3.webp" alt="" />
            <div className="idle-card" style={reveal(phase === 'idle' && !hunt, hunt ? 0 : 0.5)}>
              <p className="lbl">Khu vực thí điểm</p>
              <p className="idle-t">Vinhomes Ocean Park 1, Gia Lâm</p>
              <p className="idle-s">{busy ? 'Đội ngũ đang thẩm định…' : 'Mô tả nhu cầu bên trái để xem ba mặt bằng phù hợp nhất, bản đồ 3D và báo cáo.'}</p>
            </div>
            <div className="idle-guide" style={reveal(phase === 'idle' && !hunt, 0.8, 'translateY(24px) scale(.9)')} aria-hidden="true">
              <Mascot pose={draft.trim() ? '10-ngon-cai' : '01-chao'} size={104} say={idleLine} side="left" />
            </div>
          </div>

          {/* Danh sách */}
          <div className="st-list" style={{ pointerEvents: phase === 'list' ? 'auto' : 'none' }} aria-hidden={!listShown}>
            {(recs || []).map((r, i) => (
              <button key={r.code} type="button" className="row" onClick={() => open(i)} aria-label={`Mở ${r.name}, ${r.score} điểm`}
                style={listShown
                  ? { opacity: 1, transform: 'none', transitionDelay: (phase === 'zout' ? 0.12 + Math.abs(i - sel) * 0.06 : i * 0.08) + 's' }
                  : { opacity: 0, transform: i === sel ? 'none' : 'translateY(18px) scale(.98)', transitionDuration: '.28s' }}>
                <span className="ri" ref={(el) => { rowImgRefs.current[i] = el; }} style={{ visibility: phase !== 'list' && i === sel ? 'hidden' : 'visible' }}>
                  <img src={r.src} alt="" />
                  <span className="rbadge">{pad2(i + 1)} · {i === 0 ? 'Phù hợp nhất' : i === 1 ? 'Lựa chọn thứ hai' : 'Lựa chọn thứ ba'}</span>
                </span>
                <span className="rinfo">
                  <span>
                    <span className="r-name">{r.name}</span>
                    <span className="r-meta">{r.meta}</span>
                  </span>
                  <span className="r-foot">
                    <span className="r-price">{r.price}</span>
                    <span className="r-score"><CountUp to={r.score} run={listShown} delay={250 + i * 80} /><small>/100</small></span>
                  </span>
                  <span className="r-meter" aria-hidden="true"><i style={{ transform: `scaleX(${listShown ? r.score / 100 : 0})`, transitionDelay: listShown ? 0.25 + i * 0.08 + 's' : '0s' }} /></span>
                  <span className="r-open" aria-hidden="true">Xem chi tiết<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h9.5m0 0L8.5 4m4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                </span>
              </button>
            ))}
          </div>

          {/* Chi tiết + báo cáo */}
          <div className={'st-detail' + (shown || phase === 'zout' ? ' on' : '')} aria-hidden={!detail}>
            <header className="d-head" style={reveal(shown, 0.22, 'translateY(-10px)')}>
              <button type="button" className="d-back" onClick={back} aria-label="Quay lại danh sách">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13 8H3.5m0 0L7.5 4m-4 4 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <div className="d-title">
                <p className="lbl">Kết quả {pad2(sel + 1)} / 03 · {sel === 0 ? 'Phù hợp nhất' : 'Lựa chọn ' + (sel === 1 ? 'thứ hai' : 'thứ ba')}</p>
                <h2>{cur ? cur.name : ''}</h2>
              </div>
              <dl className="d-stats">
                <div><dt>Giá thuê</dt><dd>{cur ? cur.price : ''}</dd></div>
                <div><dt>Diện tích</dt><dd>{cur ? cur.size.replace(' m²', '') : ''} m²</dd></div>
                <div><dt>Phù hợp</dt><dd>{cur ? <CountUp key={cur.code} to={cur.score} run={shown} delay={300} /> : ''}<small>/100</small></dd></div>
              </dl>
              <div className="d-actions">
                {cur && <a className="d-profile" href={profileHref(cur.code)} tabIndex={detail ? undefined : -1}>
                  Hồ sơ chi tiết
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h9.5m0 0L8.5 4m4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </a>}
                <button type="button" className={'d-report' + (reportOpen ? ' is-open' : '')} onClick={() => setReportOpen((v) => !v)} aria-expanded={reportOpen} aria-controls="d-sheet">
                  <span className="d-report-t" key={reportOpen ? 'a' : 'b'}>{reportOpen ? 'Thu gọn báo cáo' : 'Báo cáo đầy đủ'}</span>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 10 4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>
            </header>

            <div className="d-clip" style={{ pointerEvents: detail ? 'auto' : 'none' }}>
              <div className={'d-pane' + (sheetOpen ? ' is-back' : '')}>
                <div className="d-map" ref={mapSlotRef}>
                  <div className="mapbox" ref={mapElRef} style={{ opacity: detail ? 1 : 0 }} />
                  <div className="photobox" style={{ opacity: detail && view >= 0 ? 1 : 0 }}>
                    {rep && view >= 0 && <img key={view} src={rep.photos[view].src} alt={rep.photos[view].label + ', ' + rep.name} />}
                  </div>
                  {rep && (
                    <>
                      <div className="legend" style={reveal(shown && view < 0, 0.4, 'translateY(-8px)')}>
                        {[['mine', 'Mặt bằng'], ['comp', `Đối thủ cùng ngành (${rep.compCount})`], ['cust', `Nguồn khách (${rep.labels.length})`], ['links', 'Khoảng cách']].map(([k, label]) => (
                          <button key={k} type="button" className={'lg ' + k} aria-pressed={toggles[k]} onClick={() => setToggles((s) => ({ ...s, [k]: !s[k] }))}><i aria-hidden="true" />{label}</button>
                        ))}
                      </div>
                      <div className="decide" style={reveal(shown, 0.48, 'translateY(18px)')}>
                        <div><p className="lbl good">Điểm mạnh</p><ul>{rep.strengths.slice(0, 2).map((t) => <li key={t}>{t}</li>)}</ul></div>
                        <div><p className="lbl risk">Rủi ro</p><ul className="risk">{rep.risks.slice(0, 2).map((t) => <li key={t}>{t}</li>)}</ul></div>
                      </div>
                      <p className="map-note" style={reveal(shown && view < 0, 0.6, 'none')}>Khối nhà từ OpenStreetMap · khoảng cách là đường thẳng</p>
                    </>
                  )}
                </div>
                <div className="d-strip">
                  {thumbs.map((t, k) => (
                    <button key={t.label} type="button" className={'th' + (view === t.v ? ' on' : '') + (t.v < 0 ? ' th-map' : '')} onClick={() => setView(t.v)} aria-pressed={view === t.v} style={reveal(shown, 0.3 + k * 0.05, 'translateY(16px)')}>
                      {t.src ? <img src={t.src} alt="" /> : <span className="th-grid" aria-hidden="true" />}
                      <span className="thl">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              {/* Báo cáo đầy đủ: tấm trượt từ dưới lên phủ bản đồ */}
              <div id="d-sheet" className={'d-sheet' + (sheetOpen ? ' open' : '')} aria-hidden={!sheetOpen} role="region" aria-label="Báo cáo đầy đủ">
                <button type="button" className="sheet-grip" onClick={() => setReportOpen(false)} aria-label="Thu gọn báo cáo" tabIndex={sheetOpen ? 0 : -1}><i /></button>
                <ReportGrid r={rep} open={sheetOpen} msg={ownerMsg} setMsg={setOwnerMsg}
                  onCopy={() => { navigator.clipboard?.writeText(ownerMsg).then(() => showToast('Đã sao chép tin nhắn.')).catch(() => showToast('Trình duyệt chặn sao chép, hãy chọn và sao chép thủ công.')); }} />
              </div>
            </div>
          </div>

          <Hunt hunt={hunt} />

          {/* Ảnh đang phóng to / thu nhỏ: điều khiển bằng Web Animations trong runZoom() */}
          <div className="zoom" ref={zoomRef} aria-hidden="true"><img ref={zoomImgRef} alt="" /></div>
        </section>
      </div>

      {toast && (
        <div className="as-toast" role="status">
          {toast.text}
          {toast.action && <button type="button" onClick={toast.action.run}>{toast.action.label}</button>}
        </div>
      )}
    </div>
  );
}
