// Trang Trợ lý mặt bằng (/tro-ly/): chat bên trái, khung kết quả bên phải.
// Khung phải có 4 trạng thái: chờ → danh sách 3 mặt bằng → chi tiết (bản đồ 3D, ảnh) → báo cáo đầy đủ.
// Chuyển động theo hai đường cong: ease-layout (khung đẩy nhau, ảnh phóng to) và ease-reveal (nội dung hiện ra).
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Robot from './Robot.jsx';

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
const SUGGESTIONS = [
  'Mở quán cà phê ở Ocean Park, ngân sách khoảng 50 triệu/tháng, diện tích 150–250 m², cần chỗ đỗ ô tô',
  'Tìm mặt bằng trà sữa gần trường học, dưới 30 triệu/tháng',
  'Cửa hàng tiện lợi gần chung cư, diện tích 60–100 m², tầm 25 triệu'
];
const pad2 = (n) => String(n).padStart(2, '0');
let uid = 0;
const id = () => ++uid;

async function postJson(url, body, signal) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || 'Lỗi ' + res.status); e.status = res.status; throw e; }
  return data;
}
const later = (ms) => new Promise((r) => setTimeout(r, ms));
const relRect = (el, base) => {
  const a = el.getBoundingClientRect(), b = base.getBoundingClientRect();
  return { left: a.left - b.left, top: a.top - b.top, width: a.width, height: a.height };
};

/* ---------------- Cột chat ---------------- */

function Bubble({ m, onPick, active, onAsk, onShare }) {
  if (m.k === 'user') return <div className="b-user es-up">{m.text}</div>;
  if (m.k === 'agents') {
    return (
      <div className={'b-agents es-up' + (m.done ? ' is-done' : '')} role="status">
        <p className="ag-title">{m.done ? 'Đội ngũ đã thẩm định xong' : m.reading ? 'Đang đọc nhu cầu của anh/chị…' : 'Đội ngũ đang thẩm định'}</p>
        <ol>
          {AGENTS.map((a, i) => {
            const st = m.done || i < m.step ? 'done' : i === m.step && !m.reading ? 'run' : 'wait';
            return (
              <li key={a.name} className={st}>
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
  if (m.k === 'thinking') return <div className="b-bot thinking es-up" role="status"><span className="dots" aria-hidden="true"><i /><i /><i /></span>{m.text}</div>;
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
          <button key={r.code} type="button" className={'mini' + (active === i ? ' is-on' : '')} onClick={() => onPick(i)} aria-label={`Mở ${r.name}, ${r.score} điểm`}>
            <span className="mi-idx">{pad2(i + 1)}</span>
            <span className="mi-name">{r.name.split(',')[0]}, {r.name.split(',').slice(1).join(',').trim()}</span>
            <span className="mi-price">{Math.round(r.rentM)} tr</span>
            <span className="mi-score">{r.score}</span>
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
      <section className="card c-contact">
        <h3>Liên hệ chủ nhà</h3>
        <p className="sent-ok" role="status"><span aria-hidden="true">✓</span> Đã gửi lời nhắn về {r.code}. Đội ngũ estateSmartAI sẽ liên hệ chủ nhà và gọi lại cho anh/chị để hẹn lịch xem.</p>
        <p className="sent">Bản thử nghiệm: thông tin mặt bằng là dữ liệu mô phỏng, đội ngũ sẽ xác nhận lại khi gọi.</p>
        <a className="full-link" href={'/mat-bang/?ma=' + encodeURIComponent(r.code)}>Mở hồ sơ để in hoặc tải PDF</a>
      </section>
    );
  }
  return (
    <form className="card c-contact" onSubmit={submit} noValidate>
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
        <button type="submit" className="btn-light" disabled={state === 'sending'}>{state === 'sending' ? 'Đang gửi…' : open ? 'Gửi lời nhắn' : 'Gửi cho chủ nhà'}</button>
        <button type="button" className="btn-ghost-d" onClick={onCopy}>Sao chép</button>
      </div>
      <a className="full-link" href={'/mat-bang/?ma=' + encodeURIComponent(r.code)}>Mở hồ sơ để in hoặc tải PDF</a>
    </form>
  );
}

function ReportGrid({ r, onCopy, msg, setMsg }) {
  if (!r) return <div className="grid-wait">Đang tải báo cáo…</div>;
  const t = r.traffic;
  const max = Math.max(r.rentCompare.mine, r.rentCompare.median) * 1.08;
  return (
    <div className="rgrid">
      <section className="card c-comp">
        <header><h3>Đối thủ cùng ngành trong {r.compRadius} m</h3><span className="big comp">{r.compCount}</span></header>
        {r.competitors.length ? (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Cửa hàng</th><th>Loại</th><th className="num">Cách</th><th>Nguồn</th></tr></thead>
              <tbody>{r.competitors.map((c, i) => <tr key={i}><td>{c.name}</td><td>{c.kind}</td><td className="num">{c.dText}</td><td>{c.source}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <p className="empty">Chưa có cơ sở cùng ngành nào trong {r.compRadius} m trên OpenStreetMap.</p>}
        <p className="read"><i className="dot good" />{r.compNote}</p>
      </section>

      <section className="card c-traffic">
        <header><h3>Lưu lượng theo giờ</h3><span className="tag">Ước lượng</span></header>
        <div className="bars" role="img" aria-label={'Lưu lượng ước lượng: ' + t.bars.map((b) => b.label + ' ' + b.v + '%').join(', ')}>
          {t.bars.map((b, i) => (
            <div key={b.label} className="bar-col">
              <span className={'bar' + (i === t.peak ? ' peak' : '')} style={{ height: Math.max(6, b.v) + '%' }} />
              <span className="bar-l">{b.label}</span>
            </div>
          ))}
        </div>
        <p className="read">{t.text}</p>
        <p className="src">Ước lượng từ loại tiện ích xung quanh (OpenStreetMap), không phải số đo thực tế.</p>
      </section>

      <section className="card c-rent">
        <h3>Giá thuê so với khu vực</h3>
        <div className="cmp">
          <div className="cmp-row"><span>Mặt bằng này</span><b>{r.rentCompare.mine.toLocaleString('vi-VN')} triệu/tháng</b></div>
          <span className="track"><span className="fill mine" style={{ width: (r.rentCompare.mine / max) * 100 + '%' }} /></span>
          <div className="cmp-row muted"><span>Trung vị khu vực</span><b>{r.rentCompare.median.toLocaleString('vi-VN')} triệu/tháng</b></div>
          <span className="track"><span className="fill med" style={{ width: (r.rentCompare.median / max) * 100 + '%' }} /></span>
        </div>
        <p className="read">{r.rentCompare.diff === 0 ? 'Ngang mức chung.' : r.rentCompare.diff > 0 ? `Cao hơn mức chung khoảng ${r.rentCompare.diff}%.` : `Thấp hơn mức chung khoảng ${-r.rentCompare.diff}%.`}</p>
        <p className="src">Quy đổi theo diện tích, so với {r.rentCompare.n} {r.rentCompare.typeLabel} trong hệ thống (dữ liệu mô phỏng).</p>
      </section>

      <section className="card c-access">
        <h3>Tiếp cận và đỗ xe</h3>
        <dl>{r.access.map((a) => <div key={a.label} className={a.warn ? 'warn' : ''}><dt>{a.label}</dt><dd>{a.value}</dd></div>)}</dl>
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
  const [phase, setPhase] = useState('idle'); // idle | list | z0 | z1 | detail | b0 | b1
  const [sel, setSel] = useState(0);
  const [view, setView] = useState(-1); // -1 bản đồ, 0..n ảnh
  const [reportOpen, setReportOpen] = useState(false);
  const [reports, setReports] = useState({});
  const [toggles, setToggles] = useState({ mine: true, comp: true, cust: true, links: true });
  const [ownerMsg, setOwnerMsg] = useState('');
  const [shareId, setShareId] = useState(null);
  const [toast, setToast] = useState(null);
  const [entered, setEntered] = useState(REDUCE);

  const stageRef = useRef(null);
  const rowImgRefs = useRef([]);
  const mapSlotRef = useRef(null);
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const rects = useRef({ row: null, map: null });
  const threadRef = useRef(null);
  const inputRef = useRef(null);
  const askCtrl = useRef(null);
  const session = useRef(0);
  const toastTimer = useRef(null);

  const cur = recs ? recs[sel] : null;
  const rep = cur ? reports[cur.code] : null;
  const detail = phase === 'detail';

  useEffect(() => { const t = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true))); return () => cancelAnimationFrame(t); }, []);
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
    try {
      const parsed = await postJson('/api/parse', { text, prev: criteria || {} });
      if (my !== session.current) return;
      if (parsed.ask) {
        setCriteria(parsed.criteria);
        dropAg();
        push({ k: 'ask', text: parsed.ask.q, options: parsed.ask.options, open: true });
        setBusy(false);
        return;
      }
      const crit = parsed.criteria;
      const need = [crit.model, crit.area, crit.budget && 'ngân sách ' + crit.budget.charAt(0).toLowerCase() + crit.budget.slice(1), crit.size].filter(Boolean).join(', ');
      setAg({ reading: false, step: 0, facts: [need || null] });
      // Mỗi bước giữ ít nhất STEP_MS để người dùng kịp đọc; bước cuối chờ máy chủ trả kết quả.
      const stepping = (async () => { for (let i = 1; i < AGENTS.length; i++) { await later(T(STEP_MS)); if (my !== session.current) return; setAg({ step: i }); } await later(T(STEP_MS)); })();
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
      try { sessionStorage.setItem('es-recs', JSON.stringify({ codes: rows.map((r) => r.code), criteria: crit })); } catch (e) { /* bỏ qua */ }
      data.notes.forEach((n) => push({ k: 'bot', text: n }));
      push({ k: 'results', text: `Đội ngũ đã rà soát ${data.stats.total} mặt bằng trong hệ thống, ${data.stats.fit} vừa ngân sách và diện tích. Đây là ba lựa chọn đáng đi xem nhất:`, rows });
      setSel(0);
      setView(-1);
      setPhase('list');
      rows.forEach((r) => postJson('/api/report', { code: r.code, criteria: crit }).then((rp) => setReports((s) => ({ ...s, [r.code]: rp }))).catch(() => {}));
      ensureMap();
    } catch (e) {
      if (my !== session.current) return;
      dropAg();
      push({ k: 'bot', text: e.status === 429 ? e.message : 'Chưa kết nối được máy chủ thẩm định. Anh/chị thử lại sau ít phút.' });
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

  // ---- Chuyển cảnh: ảnh của dòng phóng thành khung bản đồ, và ngược lại ----
  const measure = (i) => {
    const st = stageRef.current;
    const img = rowImgRefs.current[i];
    if (st && img) rects.current.row = relRect(img, st);
    if (st && mapSlotRef.current) rects.current.map = relRect(mapSlotRef.current, st);
  };
  const open = async (i) => {
    if (!recs) return;
    if (phase === 'detail' && sel !== i) { await back(); await later(T(120)); }
    else if (phase !== 'list') { if (phase === 'detail' && sel === i) return; return; }
    ensureMap();
    loadReport(recs[i].code, final);
    // Màn hình hẹp: khung kết quả nằm dưới chat, cuộn tới trước khi phóng ảnh.
    if (window.innerWidth <= 980 && stageRef.current) {
      stageRef.current.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'start' });
      await later(T(450));
    }
    setSel(i);
    setView(-1);
    measure(i);
    setPhase('z0');
    // Mỗi bước chỉ chạy nếu trang còn ở đúng bước trước (khung hình có thể đến trễ khi tab bị ẩn).
    requestAnimationFrame(() => requestAnimationFrame(() => setPhase((p) => (p === 'z0' ? 'z1' : p))));
    await later(T(880));
    setPhase((p) => (p === 'z0' || p === 'z1' ? 'detail' : p));
    const r = recs[i];
    const rp = reports[r.code];
    push({ k: 'sum', i, name: r.name, score: r.score, price: r.price, area: r.size.replace(' m²', ''), risk: (rp && rp.mainRisk) || (r.cons && r.cons[0]) || null });
  };
  const back = async () => {
    if (phase !== 'detail') return;
    if (reportOpen) { setReportOpen(false); await later(T(980)); } // đợi phần báo cáo trượt xuống hẳn rồi mới đo
    measure(sel);
    setPhase('b0');
    await later(T(300));
    setPhase((p) => (p === 'b0' ? 'b1' : p));
    await later(T(880));
    setPhase((p) => (p === 'b1' || p === 'b0' ? 'list' : p));
    setView(-1);
  };

  const reset = () => {
    const snap = { msgs, recs, phase: phase === 'detail' || phase === 'list' ? phase : recs ? 'list' : 'idle', sel, final, reports, criteria };
    session.current++;
    if (askCtrl.current) askCtrl.current.abort();
    setBusy(false);
    setMsgs([{ id: id(), k: 'bot', text: 'Mình bắt đầu phiên mới. Anh/chị mô tả nhu cầu trong một câu nhé.' }]);
    setRecs(null); setFinal(null); setCriteria(null); setPhase('idle'); setReportOpen(false); setView(-1);
    if (mapRef.current) mapRef.current.update(null);
    showToast('Đã bắt đầu phiên mới.', { label: 'Hoàn tác', run: () => { setMsgs(snap.msgs); setRecs(snap.recs); setFinal(snap.final); setReports(snap.reports); setCriteria(snap.criteria); setSel(snap.sel); setPhase(snap.phase === 'detail' ? 'list' : snap.phase); setToast(null); } });
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && detail) { e.preventDefault(); back(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---- Giá trị hiển thị ----
  const zooming = ['z0', 'z1', 'detail', 'b0', 'b1'].includes(phase);
  const listShown = phase === 'list' || phase === 'z0' || phase === 'b1';
  const zr = phase === 'z0' || phase === 'b1' ? rects.current.row : rects.current.map;
  const zoomStyle = zooming && zr ? {
    left: zr.left, top: zr.top, width: zr.width, height: zr.height,
    borderRadius: phase === 'z0' || phase === 'b1' ? 18 : 20,
    transition: phase === 'z0' ? 'none' : undefined,
    opacity: phase === 'detail' ? 0 : 1,
    transitionDelay: phase === 'detail' ? '.6s' : undefined
  } : { display: 'none' };
  const activeIdx = detail || phase === 'z1' || phase === 'z0' ? sel : -1;
  const thinking = busy;
  const thumbs = useMemo(() => [{ label: 'Bản đồ 3D', v: -1 }, ...((rep && rep.photos) || []).map((p, j) => ({ ...p, v: j }))], [rep]);
  const reveal = (on, delay = 0, off = 'translateY(12px)') => (on ? { opacity: 1, transform: 'none', transitionDelay: delay + 's' } : { opacity: 0, transform: off, pointerEvents: 'none', transitionDelay: '0s' });

  return (
    <div className={'as-page' + (entered ? ' in' : '')}>
      <header className="as-top">
        <a className="as-brand" href="/">
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden="true"><g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.4 4H7a3 3 0 0 0-3 3v18a3 3 0 0 0 3 3h1.6" /><path d="M23.4 4H25a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H14.6" /><path d="M11.2 29.5 20.8 2.5" /></g><circle cx="21.6" cy="20.6" r="2.6" fill="#A3562B" /></svg>
          estateSmart / AI
        </a>
      </header>

      <div className="as-main">
        {/* ---------- CHAT ---------- */}
        <aside className="as-chat" aria-label="Trợ lý mặt bằng">
          <header className="ch-head">
            <Robot thinking={thinking} />
            <div className="ch-title">
              <h1>Trợ lý mặt bằng</h1>
              <p><i className="live" aria-hidden="true" />Đội ngũ 5 chuyên viên AI đang trực tuyến</p>
            </div>
            <button type="button" className="ch-x" onClick={reset} aria-label="Bắt đầu phiên mới">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3.5 3.5 9 9m0-9-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
          </header>
          <div className="ch-thread" ref={threadRef} role="log" aria-live="polite" aria-label="Hội thoại">
            {msgs.map((m) => <Bubble key={m.id} m={m} onPick={open} active={activeIdx} onAsk={(o) => send(o)} onShare={recs ? share : null} />)}
            {!recs && !criteria && msgs.length <= 2 && !busy && (
              <div className="sugg">
                {SUGGESTIONS.map((s, i) => <button key={s} type="button" className="sugg-b es-up" style={{ animationDelay: 0.75 + i * 0.09 + 's' }} onClick={() => send(s)}>{s}</button>)}
              </div>
            )}
          </div>
          <form className="ch-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <label htmlFor="as-input" className="sr-only">Mô tả nhu cầu hoặc đặt câu hỏi</label>
            <input id="as-input" ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} autoComplete="off" maxLength={500}
              placeholder={recs && !criteria ? (busy ? 'Trợ lý đang trả lời…' : 'Hỏi thêm về ba mặt bằng…') : 'Mô tả mô hình, khu vực, ngân sách…'} />
            <button type="submit" className={'send' + (draft.trim() && !busy ? '' : ' dim')} aria-label="Gửi">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 13V3.5m0 0L4 7.5m4-4 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </form>
          {recs && <p className="ch-note">Câu hỏi được gửi tới mô hình AI bên thứ ba, đừng nhập thông tin cá nhân. Số liệu mặt bằng là dữ liệu minh hoạ.</p>}
        </aside>

        {/* ---------- KHUNG PHẢI ---------- */}
        <section className="as-stage" ref={stageRef} aria-label="Kết quả thẩm định">
          {/* Chờ */}
          <div className={'st-idle' + (phase === 'idle' ? '' : ' gone')} aria-hidden={phase !== 'idle'}>
            <img src="/images/hero3.webp" alt="" />
            <div className="idle-card" style={reveal(phase === 'idle', 0.5)}>
              <p className="lbl">Khu vực thí điểm</p>
              <p className="idle-t">Vinhomes Ocean Park 1, Gia Lâm</p>
              <p className="idle-s">{busy ? 'Đội ngũ đang thẩm định…' : 'Mô tả nhu cầu bên trái để xem ba mặt bằng phù hợp nhất, bản đồ 3D và báo cáo.'}</p>
            </div>
          </div>

          {/* Danh sách */}
          <div className="st-list" style={{ opacity: listShown ? 1 : 0, pointerEvents: phase === 'list' ? 'auto' : 'none' }} aria-hidden={!listShown}>
            {(recs || []).map((r, i) => (
              <button key={r.code} type="button" className="row" onClick={() => open(i)} aria-label={`Mở ${r.name}, ${r.score} điểm`}
                style={listShown ? { opacity: 1, transform: 'none', transitionDelay: (phase === 'list' ? i * 0.09 : 0) + 's' } : { opacity: 0, transform: 'translateY(24px)' }}>
                <span className="ri" ref={(el) => { rowImgRefs.current[i] = el; }} style={{ visibility: zooming && i === sel ? 'hidden' : 'visible' }}>
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
                    <span className="r-score">{r.score}<small>/100</small></span>
                  </span>
                </span>
              </button>
            ))}
          </div>

          {/* Chi tiết + báo cáo */}
          <div className={'st-detail' + (detail || phase === 'b0' ? ' on' : '')} aria-hidden={!detail}>
            <header className="d-head" style={reveal(detail, 0.1, 'translateY(-10px)')}>
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
                <div><dt>Phù hợp</dt><dd>{cur ? cur.score : ''}<small>/100</small></dd></div>
              </dl>
              <button type="button" className="d-report" onClick={() => setReportOpen((v) => !v)} aria-expanded={reportOpen}>
                {reportOpen ? 'Thu gọn báo cáo' : 'Báo cáo đầy đủ'}
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ transform: reportOpen ? 'rotate(180deg)' : 'none' }}><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </header>

            <div className="d-clip" style={{ pointerEvents: detail ? 'auto' : 'none' }}>
              <div className="d-track" style={{ transform: detail && reportOpen ? 'translateY(-50%)' : 'none' }}>
                <div className="d-pane">
                  <div className="d-map" ref={mapSlotRef}>
                    <div className="mapbox" ref={mapElRef} style={{ opacity: detail ? 1 : 0 }} />
                    <div className="photobox" style={{ opacity: detail && view >= 0 ? 1 : 0 }}>
                      {rep && view >= 0 && <img src={rep.photos[view].src} alt={rep.photos[view].label + ', ' + rep.name} />}
                    </div>
                    {rep && (
                      <>
                        <div className="legend" style={reveal(detail && view < 0, 0.25, 'translateY(-8px)')}>
                          {[['mine', 'Mặt bằng'], ['comp', `Đối thủ cùng ngành (${rep.compCount})`], ['cust', `Nguồn khách (${rep.labels.length})`], ['links', 'Khoảng cách']].map(([k, label]) => (
                            <button key={k} type="button" className={'lg ' + k} aria-pressed={toggles[k]} onClick={() => setToggles((s) => ({ ...s, [k]: !s[k] }))}><i aria-hidden="true" />{label}</button>
                          ))}
                        </div>
                        <div className="decide" style={reveal(detail, 0.3)}>
                          <div><p className="lbl good">Điểm mạnh</p><ul>{rep.strengths.slice(0, 2).map((t) => <li key={t}>{t}</li>)}</ul></div>
                          <div><p className="lbl risk">Rủi ro</p><ul className="risk">{rep.risks.slice(0, 2).map((t) => <li key={t}>{t}</li>)}</ul></div>
                        </div>
                        <p className="map-note" style={reveal(detail && view < 0, 0.4, 'none')}>Khối nhà từ OpenStreetMap · khoảng cách là đường thẳng</p>
                      </>
                    )}
                  </div>
                  <div className="d-strip">
                    {thumbs.map((t, k) => (
                      <button key={t.label} type="button" className={'th' + (view === t.v ? ' on' : '') + (t.v < 0 ? ' th-map' : '')} onClick={() => setView(t.v)} aria-pressed={view === t.v} style={reveal(detail, 0.15 + k * 0.06, 'translateY(16px)')}>
                        {t.src ? <img src={t.src} alt="" /> : <span className="th-grid" aria-hidden="true" />}
                        <span className="thl">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="d-pane d-report-pane" style={reveal(detail && reportOpen, 0.2, 'translateY(24px)')}>
                  <ReportGrid r={rep} msg={ownerMsg} setMsg={setOwnerMsg}
                    onCopy={() => { navigator.clipboard?.writeText(ownerMsg).then(() => showToast('Đã sao chép tin nhắn.')).catch(() => showToast('Trình duyệt chặn sao chép, hãy chọn và sao chép thủ công.')); }} />
                </div>
              </div>
            </div>
          </div>

          {/* Ảnh đang phóng to / thu nhỏ */}
          <div className="zoom" style={zoomStyle} aria-hidden="true">{cur && <img src={cur.src} alt="" />}</div>
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
