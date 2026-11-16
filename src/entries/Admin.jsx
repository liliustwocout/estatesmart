// Trang quản trị mặt bằng (/quan-tri/). Viết tay bằng React, không sinh từ design/.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/interaction.css';
import '../styles/admin.css';

async function api(path, opts = {}) {
  const res = await fetch('/api/admin' + path, {
    credentials: 'same-origin',
    ...opts,
    headers: { ...(opts.body ? { 'content-type': 'application/json' } : {}), ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : await res.text();
  if (!res.ok) { const e = new Error((data && data.error) || 'Lỗi ' + res.status); e.status = res.status; e.data = data; throw e; }
  return data;
}

const TYPE_ORDER = ['villa', 'shophouse', 'townhouse', 'podium', 'kiosk'];
const EMPTY = { status: 'active', type: 'shophouse', floors: 1, two_way: 1, divider: 0, kitchen: 0, deposit_months: 3, min_term_years: 2, car_parking_m: 300, moto_slots: 0, yard_m2: 0, frontage_m: 0, road_m: 0, suited: 'cafe', image: 'landscape-house-clean', note: '' };
const IMAGES = ['hero3', 'exterior-garden-clean', 'landscape-house-clean', 'nightSide', 'patio-front-clean', 'side', 'apartment-living', 'top', 'apartment-tour', 'living-room-clean'];

function Login({ onDone }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!pw || busy) return;
    setBusy(true); setErr('');
    try { await api('/login', { method: 'POST', body: { password: pw } }); onDone(); } catch (e2) { setErr(e2.message); setPw(''); } finally { setBusy(false); }
  };
  return (
    <main className="login">
      <form onSubmit={submit} className="card">
        <p className="brand">estateSmart/AI</p>
        <h1>Quản trị mặt bằng</h1>
        <label htmlFor="pw">Mật khẩu</label>
        <input id="pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus aria-invalid={err ? 'true' : 'false'} aria-describedby="pw-err" />
        <p id="pw-err" className="err" role="alert">{err}</p>
        <button className="btn" disabled={busy}>{busy ? 'Đang kiểm tra…' : 'Đăng nhập'}</button>
      </form>
    </main>
  );
}

function Field({ f, value, error, onChange, models }) {
  const id = 'f-' + f.key;
  let input;
  if (f.type === 'bool') {
    input = <label className="check"><input id={id} type="checkbox" checked={!!Number(value)} onChange={(e) => onChange(e.target.checked ? 1 : 0)} /> {f.label}</label>;
    return <div className={'field' + (error ? ' bad' : '')}>{input}{error && <p className="err">{error}</p>}</div>;
  }
  if (f.type === 'enum') {
    input = <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>{f.values.map((v) => <option key={v} value={v}>{f.labels?.[v] || v}</option>)}</select>;
  } else if (f.type === 'list') {
    const set = new Set(String(value || '').split(';').filter(Boolean));
    input = (
      <div className="chips" role="group" aria-labelledby={id}>
        {f.values.map((v) => (
          <label key={v} className={'chip' + (set.has(v) ? ' on' : '')}>
            <input type="checkbox" checked={set.has(v)} onChange={(e) => { const s = new Set(set); e.target.checked ? s.add(v) : s.delete(v); onChange([...s].join(';')); }} />
            {models[v] || v}
          </label>
        ))}
      </div>
    );
  } else if (f.key === 'image') {
    input = <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>{[...new Set([value, ...IMAGES].filter(Boolean))].map((v) => <option key={v} value={v}>{v}</option>)}</select>;
  } else if (f.key === 'note') {
    input = <textarea id={id} rows={2} value={value ?? ''} maxLength={f.max} onChange={(e) => onChange(e.target.value)} />;
  } else {
    const num = f.type === 'num' || f.type === 'int';
    input = <input id={id} type={f.key === 'updated' ? 'date' : num ? 'number' : 'text'} step={f.type === 'int' ? 1 : f.key === 'lat' || f.key === 'lng' ? 0.000001 : 'any'} min={f.min} max={f.max} maxLength={f.max && !num ? f.max : undefined} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <div className={'field' + (error ? ' bad' : '') + (f.key === 'name' || f.key === 'note' || f.type === 'list' ? ' wide' : '')}>
      <label htmlFor={id} id={f.type === 'list' ? id : undefined}>{f.label}{f.required && <span aria-hidden="true"> *</span>}</label>
      {input}
      {error && <p className="err">{error}</p>}
    </div>
  );
}

function Editor({ meta, listing, isNew, onClose, onSaved, onDeleted, toast }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ...listing }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => { ref.current?.querySelector('input, select')?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const fields = meta.fields.map((f) => (f.key === 'type' ? { ...f, labels: meta.types } : f)).filter((f) => f.key !== 'code' || isNew);
  const save = async (e) => {
    e.preventDefault();
    const code = String(form.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9-]{2,20}$/.test(code)) { setErrors({ code: 'Mã gồm chữ in hoa, số, dấu gạch ngang (2–20 ký tự)' }); return; }
    setBusy(true);
    try {
      const r = await api('/listings/' + code, { method: 'PUT', body: { listing: { ...form, code }, create: isNew } });
      toast(isNew ? `Đã thêm ${code}` : `Đã lưu ${code}`);
      onSaved(r.listing);
    } catch (err) {
      if (err.data?.errors) { setErrors(err.data.errors); ref.current?.querySelector('.bad input, .bad select')?.focus(); } else if (err.status === 401) location.reload(); else setErrors({ _: err.message });
    } finally { setBusy(false); }
  };
  const del = async () => {
    if (!window.confirm(`Xoá vĩnh viễn ${form.code}? Không thể hoàn tác. Nếu chỉ muốn tạm ẩn, đổi Trạng thái sang hidden.`)) return;
    try { await api('/listings/' + form.code, { method: 'DELETE' }); toast('Đã xoá ' + form.code); onDeleted(form.code); } catch (err) { setErrors({ _: err.message }); }
  };
  const osm = form.lat && form.lng ? `https://www.openstreetmap.org/?mlat=${form.lat}&mlon=${form.lng}#map=18/${form.lat}/${form.lng}` : null;
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="drawer es-enter" onSubmit={save} ref={ref} aria-label={isNew ? 'Thêm mặt bằng' : 'Sửa ' + form.code} noValidate>
        <header>
          <h2>{isNew ? 'Thêm mặt bằng' : `Sửa ${form.code}`}</h2>
          <button type="button" className="ghost" onClick={onClose} aria-label="Đóng">Đóng</button>
        </header>
        {errors._ && <p className="err banner" role="alert">{errors._}</p>}
        {Object.keys(errors).length > 0 && !errors._ && <p className="err banner" role="alert">Có {Object.keys(errors).length} ô chưa hợp lệ.</p>}
        <div className="grid">
          {fields.map((f) => (
            <Field key={f.key} f={f} value={form[f.key]} error={errors[f.key]} models={meta.models}
              onChange={(v) => { setForm((s) => ({ ...s, [f.key]: v })); if (errors[f.key]) setErrors((s) => { const n = { ...s }; delete n[f.key]; return n; }); }} />
          ))}
        </div>
        {osm && <p className="hint">Kiểm tra toạ độ: <a href={osm} target="_blank" rel="noreferrer noopener">mở trên OpenStreetMap</a></p>}
        <footer>
          {!isNew && <button type="button" className="danger" onClick={del}>Xoá</button>}
          <span style={{ flex: 1 }} />
          <button type="button" className="ghost" onClick={onClose}>Huỷ</button>
          <button className="btn" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu'}</button>
        </footer>
      </form>
    </div>
  );
}

function Importer({ onDone, toast }) {
  const [replace, setReplace] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const run = async (file) => {
    if (!file) return;
    if (file.size > 900 * 1024) { setResult({ error: 'File quá lớn (tối đa khoảng 900 KB).' }); return; }
    if (replace && !window.confirm('Thay toàn bộ: mọi mặt bằng không có trong file sẽ bị xoá. Tiếp tục?')) { fileRef.current.value = ''; return; }
    setBusy(true); setResult(null);
    try {
      const r = await api('/import', { method: 'POST', body: { csv: await file.text(), replace } });
      setResult({ ok: `Đã nhập: thêm ${r.inserted}, cập nhật ${r.updated}. Tổng ${r.total} mặt bằng.` });
      toast('Đã nhập CSV');
      onDone();
    } catch (e) {
      setResult({ error: e.message, rows: e.data?.rows });
    } finally { setBusy(false); fileRef.current.value = ''; }
  };
  return (
    <section className="import card">
      <h2>Nhập từ CSV</h2>
      <p className="hint">Dòng đầu là tên cột, giống file xuất ra. Có lỗi ở bất kỳ dòng nào thì không ghi dòng nào. Mã đã có sẽ được cập nhật, mã mới sẽ được thêm.</p>
      <div className="row">
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(e) => run(e.target.files[0])} disabled={busy} aria-label="Chọn file CSV" />
        <label className="check"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> Thay toàn bộ (xoá mặt bằng không có trong file)</label>
      </div>
      {busy && <p className="hint">Đang nhập…</p>}
      {result?.ok && <p className="ok" role="status">{result.ok}</p>}
      {result?.error && (
        <div className="err banner" role="alert">
          <p>{result.error}</p>
          {result.rows && <ul>{result.rows.slice(0, 20).map((r, i) => <li key={i}>Dòng {r.line || '?'} {r.code}: {Object.entries(r.errors).map(([k, v]) => `${k} — ${v}`).join('; ')}</li>)}</ul>}
        </div>
      )}
    </section>
  );
}

function App() {
  const [state, setState] = useState('loading'); // loading | login | ready
  const [meta, setMeta] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [edit, setEdit] = useState(null); // { listing, isNew }
  const [showImport, setShowImport] = useState(false);
  const [msg, setMsg] = useState('');
  const msgTimer = useRef(null);
  const toast = (t) => { setMsg(t); clearTimeout(msgTimer.current); msgTimer.current = setTimeout(() => setMsg(''), 3000); };

  const load = async () => {
    try { setMeta(await api('/listings')); setState('ready'); } catch (e) { if (e.status === 401) setState('login'); else { setState('error'); setMsg(e.message); } }
  };
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    if (!meta) return [];
    const t = q.trim().toLowerCase();
    return meta.listings.filter((l) => (status === 'all' || l.status === status) && (!t || `${l.code} ${l.name} ${l.zone}`.toLowerCase().includes(t)));
  }, [meta, q, status]);

  if (state === 'loading') return <p className="center">Đang tải…</p>;
  if (state === 'login') return <Login onDone={load} />;
  if (state === 'error') return <p className="center err">{msg || 'Không tải được dữ liệu.'} {msg.includes('chưa được bật') ? '' : <button className="ghost" onClick={load}>Thử lại</button>}</p>;

  const logout = async () => { await api('/logout', { method: 'POST' }).catch(() => {}); setMeta(null); setState('login'); };
  const nextCode = () => { const n = Math.max(0, ...meta.listings.map((l) => Number((l.code.match(/(\d+)$/) || [])[1]) || 0)) + 1; return 'MB-' + String(n).padStart(2, '0'); };
  const active = meta.listings.filter((l) => l.status === 'active').length;

  return (
    <div className="admin">
      <header className="top">
        <div>
          <p className="brand"><a href="/">estateSmart/AI</a> / Quản trị</p>
          <h1>Mặt bằng</h1>
          <p className="hint">{meta.listings.length} mặt bằng, {active} đang hiển thị. Dữ liệu mẫu là mô phỏng; thay bằng dữ liệu thật qua Nhập CSV hoặc sửa từng mặt bằng.</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setEdit({ listing: { code: nextCode(), updated: new Date().toISOString().slice(0, 10) }, isNew: true })}>Thêm mặt bằng</button>
          <button className="ghost" onClick={() => setShowImport((v) => !v)} aria-expanded={showImport}>Nhập CSV</button>
          <a className="ghost" href="/api/admin/export">Xuất CSV</a>
          <button className="ghost" onClick={logout}>Đăng xuất</button>
        </div>
      </header>

      {showImport && <Importer onDone={load} toast={toast} />}

      <div className="filters">
        <input type="search" placeholder="Tìm theo mã, tên, phân khu" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm mặt bằng" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Lọc trạng thái">
          <option value="all">Tất cả</option><option value="active">Đang hiển thị</option><option value="hidden">Đang ẩn</option>
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Mã</th><th>Tên</th><th>Phân khu</th><th>Loại</th><th className="num">m²</th><th className="num">Giá (triệu)</th><th>Trạng thái</th><th>Cập nhật</th></tr></thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.code} onClick={() => setEdit({ listing: l, isNew: false })} className={l.status === 'hidden' ? 'muted' : ''}>
                <td><button className="link" onClick={(e) => { e.stopPropagation(); setEdit({ listing: l, isNew: false }); }}>{l.code}</button></td>
                <td>{l.name}</td><td>{l.zone}</td><td>{meta.types[l.type] || l.type}</td>
                <td className="num">{l.area_m2}</td><td className="num">{l.rent_million}</td>
                <td><span className={'tag ' + l.status}>{l.status === 'active' ? 'Hiển thị' : 'Ẩn'}</span></td>
                <td>{l.updated}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="center">Không có mặt bằng nào khớp.</td></tr>}
          </tbody>
        </table>
      </div>

      {edit && (
        <Editor meta={{ ...meta, fields: meta.fields.map((f) => (f.key === 'type' ? { ...f, values: TYPE_ORDER } : f)) }} listing={edit.listing} isNew={edit.isNew} toast={toast}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); load(); }}
          onDeleted={() => { setEdit(null); load(); }} />
      )}
      {msg && <div className="toast" role="status">{msg}</div>}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
