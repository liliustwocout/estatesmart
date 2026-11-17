// Các khối báo cáo vẽ bằng biểu tượng thay cho câu chữ: thông số căn, tiện ích ưu tiên, đi lại.
import React from 'react';

// Biểu tượng nét, 24×24, dùng currentColor.
const P = {
  area: <><path d="M4 4h16v16H4z" /><path d="M4 9h5V4M15 20v-5h5" /></>,
  bed: <><path d="M3 18V7M21 18v-5a3 3 0 0 0-3-3h-7v6" /><path d="M3 15h18" /><circle cx="7" cy="11.5" r="1.8" /></>,
  bath: <><path d="M4 12h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" /><path d="M7 12V6a2 2 0 0 1 3.5-1.3M7 19l-1 2M17 19l1 2" /></>,
  tower: <><path d="M6 21V4h12v17M3 21h18" /><path d="M9.5 8h1M13.5 8h1M9.5 12h1M13.5 12h1M9.5 16h1M13.5 16h1" /></>,
  house: <><path d="M4 11 12 4l8 7M6 9.5V20h12V9.5" /><path d="M10 20v-5h4v5" /></>,
  legal: <><path d="M7 3h8l4 4v14H7z" /><path d="M15 3v4h4M10 14l2 2 4-4" /></>,
  sofa: <><path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3" /><path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3z" /></>,
  car: <><path d="M5 16V12l2-5h10l2 5v4" /><path d="M3 16h18v3H3zM5 12h14" /><circle cx="7.5" cy="16" r="1" /><circle cx="16.5" cy="16" r="1" /></>,
  lift: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="m9 9 2-2 2 2M9 15l2 2 2-2" transform="translate(1 0)" /></>,
  tree: <><path d="M12 21v-6" /><path d="M12 3a5 5 0 0 1 4.6 7A4 4 0 0 1 15 17H9a4 4 0 0 1-1.6-7A5 5 0 0 1 12 3z" /></>,
  coin: <><circle cx="12" cy="12" r="8" /><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" /></>,
  bus: <><rect x="5" y="3" width="14" height="15" rx="2" /><path d="M5 11h14M8 18v2M16 18v2" /><circle cx="8.5" cy="14.5" r=".6" /><circle cx="15.5" cy="14.5" r=".6" /></>,
  work: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 12h18" /></>,
  school: <><path d="m2 9 10-5 10 5-10 5z" /><path d="M6 11v5c3 2 9 2 12 0v-5M22 9v6" /></>,
  shop: <><path d="M5 8h14l-1 12H6z" /><path d="M9 8a3 3 0 0 1 6 0" /></>,
  health: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8M8 12h8" /></>,
  park: <><path d="M12 21v-5" /><path d="M7 16h10l-5-12z" /></>,
  sport: <><path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12" /></>,
  pool: <><path d="M3 17c2 0 2-1.5 4.5-1.5S9.5 17 12 17s2.5-1.5 4.5-1.5S19 17 21 17" /><path d="M8 14V5a2 2 0 0 1 4 0M14 14V5a2 2 0 0 1 4 0M8 9h6" /></>,
  play: <><path d="M4 21V5h8l8 16" /><path d="M4 9h6" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  chev: <path d="m6 9 6 6 6-6" />,
  cross: <path d="m6 6 12 12M18 6 6 18" />
};
export function Icon({ name, size = 20, className }) {
  return (
    <svg className={'ico' + (className ? ' ' + className : '')} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name]}
    </svg>
  );
}

const GROUP_ICON = { giao_duc: 'school', mua_sam: 'shop', y_te: 'health', xanh: 'park', the_thao: 'sport', di_lai: 'bus' };
const INSIDE_ICON = { be_boi: 'pool', gym: 'sport', san_choi: 'play', vuon: 'tree', mam_non: 'school', tien_loi: 'shop' };
const DIR_DEG = { bac: 0, dong_bac: 45, dong: 90, dong_nam: 135, nam: 180, tay_nam: 225, tay: 270, tay_bac: 315 };
const legendGroup = (g) => (g === 'the_thao' ? 'xanh' : g);
const Repeat = ({ n, icon, max = 5 }) => (
  <span className="rep" aria-hidden="true">
    {Array.from({ length: Math.min(n, max) }, (_, i) => <Icon key={i} name={icon} size={22} />)}
    {n > max && <b>+{n - max}</b>}
  </span>
);

// Tầng: nhà đất vẽ đúng số tầng; căn hộ vẽ toà với một dải sáng ở vị trí tầng của căn.
function Floors({ h }) {
  if (!h.apt) {
    const n = Math.min(h.floors || 1, 6);
    return (
      <svg className="floors" viewBox="0 0 40 48" width="40" height="48" aria-hidden="true">
        <path d="M6 14 20 4l14 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        {Array.from({ length: n }, (_, i) => <rect key={i} x="9" y={46 - (i + 1) * (32 / n)} width="22" height={32 / n - 2} rx="1.5" className="fl on" />)}
      </svg>
    );
  }
  const top = Math.max(30, h.floor + 4);
  const y = 44 - (h.floor / top) * 38;
  return (
    <svg className="floors" viewBox="0 0 40 48" width="40" height="48" aria-hidden="true">
      <rect x="10" y="4" width="20" height="42" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M13 ${9 + i * 4.2}h14`} stroke="currentColor" strokeOpacity=".22" strokeWidth="1" />)}
      <rect x="7" y={y - 2} width="26" height="4.5" rx="1" className="fl on" />
    </svg>
  );
}

function Compass({ dir }) {
  const deg = DIR_DEG[dir];
  return (
    <svg className="compass" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
      <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="1.5" />
      {['B', 'Đ', 'N', 'T'].map((t, i) => <text key={t} x={24 + 15 * Math.sin((i * Math.PI) / 2)} y={24 - 15 * Math.cos((i * Math.PI) / 2) + 3.5} textAnchor="middle" fontSize="8" fill="currentColor" fillOpacity=".55">{t}</text>)}
      {deg != null && <g style={{ transform: `rotate(${deg}deg)`, transformOrigin: '24px 24px' }}><path d="M24 9 28.5 25h-9z" className="needle" /><circle cx="24" cy="24" r="2.2" className="needle" /></g>}
    </svg>
  );
}

const FURN_LEVEL = { tho: 1, co_ban: 2, day_du: 3 };

export function HomeCard({ r }) {
  const h = r.home;
  const ok = (v) => <Icon name={v ? 'check' : 'cross'} size={14} className={v ? 'yes' : 'no'} />;
  return (
    <section className="card c-home" style={{ '--i': 0 }}>
      <header><h3>Căn nhà</h3><span className="tag">{r.dealLabel} {r.typeLabel.toLowerCase()}</span></header>
      <div className="tiles">
        <div className="tile t-area"><Icon name="area" /><b>{h.area}<small> m²</small></b><span>Diện tích</span></div>
        <div className="tile"><Repeat n={h.bedrooms} icon="bed" /><b>{h.bedrooms}</b><span>Phòng ngủ</span></div>
        <div className="tile"><Repeat n={h.bathrooms || 0} icon="bath" /><b>{h.bathrooms}</b><span>Phòng tắm</span></div>
        <div className="tile"><Floors h={h} /><b>{h.apt ? 'Tầng ' + h.floor : h.floors + ' tầng'}</b><span>{h.apt ? 'Vị trí trong toà' : 'Số tầng'}</span></div>
        <div className="tile"><Compass dir={h.direction} /><b>{h.directionLabel || '–'}</b><span>Hướng</span></div>
        {h.legal ? (
          <div className={'tile t-legal ' + (h.legal === 'so_hong' ? 'good' : 'warn')}><Icon name="legal" /><b>{h.legalLabel}</b><span>Pháp lý</span></div>
        ) : (
          <div className="tile"><span className="tile-ic"><Icon name="sofa" /><span className="meter" aria-hidden="true">{[1, 2, 3].map((i) => <i key={i} className={i <= (FURN_LEVEL[h.furnished] || 0) ? 'on' : ''} />)}</span></span><b>{h.furnishedLabel || '–'}</b><span>Nội thất</span></div>
        )}
      </div>
      <ul className="flags">
        <li className={h.parking === 'khong' ? 'no' : ''}><Icon name="car" size={18} />{h.parkingLabel || 'Chỗ đỗ ô tô: chưa rõ'}</li>
        <li className={h.elevator ? '' : 'no'}><Icon name="lift" size={18} />Thang máy {ok(h.elevator)}</li>
        {h.legal && <li><Icon name="sofa" size={18} />{h.furnishedLabel}</li>}
        {h.yard > 0 && <li><Icon name="tree" size={18} />Sân {h.yard} m²</li>}
        {h.mgmtFee != null && <li><Icon name="coin" size={18} />Phí dịch vụ {String(h.mgmtFee).replace('.', ',')} nghìn/m²</li>}
      </ul>
    </section>
  );
}

// Tiện ích ưu tiên với gia đình này hiện dạng ô; toàn bộ bảng nằm trong phần thu gọn.
export function EcoCard({ r }) {
  const all = r.eco.flatMap((g) => g.items.map((x) => ({ ...x, group: g.key })));
  let top = all.filter((x) => x.weight >= 3);
  if (top.length < 3) {
    const more = all.filter((x) => x.weight > 0 && x.nearest && !top.includes(x)).sort((a, b) => b.weight * b.score - a.weight * a.score);
    top = [...top, ...more].slice(0, 4);
  }
  return (
    <section className="card c-eco" style={{ '--i': 2 }}>
      <header><div><h3>Hệ sinh thái quanh nhà</h3><p className="sub">Tiện ích quan trọng nhất với nhà mình</p></div></header>
      <div className="eco-top">
        {top.map((x) => {
          const g = legendGroup(x.group);
          const n = x.nearest;
          return (
            <div key={x.key} className={'eco-t g-' + g}>
              <span className="eco-ic"><Icon name={GROUP_ICON[x.group]} size={18} /></span>
              <span className="eco-l">{x.label}</span>
              <b className="eco-v">{n ? (n.inside ? 'Trong toà' : n.text) : 'Chưa có'}</b>
              <span className="eco-n">{n ? n.name : 'Chưa ghi nhận trong dữ liệu'}</span>
              <span className="track" aria-hidden="true"><span className="fill" style={{ width: x.score + '%' }} /></span>
            </div>
          );
        })}
      </div>
      <details className="eco-more">
        <summary>Xem tất cả tiện ích ({all.length})<Icon name="chev" size={14} className="chev" /></summary>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Tiện ích</th><th>Gần nhất</th><th className="num">Cách</th><th className="num">Điểm</th></tr></thead>
            {r.eco.map((g) => (
              <tbody key={g.key}>
                <tr className="grp"><th colSpan={3} scope="rowgroup"><i className={'gdot g-' + legendGroup(g.key)} aria-hidden="true" />{g.label}</th><th className="num">{g.score ?? '–'}</th></tr>
                {g.items.map((x) => (
                  <tr key={x.key} className={x.weight === 0 ? 'is-off' : ''}>
                    <td>{x.label}{x.weight === 0 && <span className="off" title="Không hợp tuổi các con nên không tính vào điểm">không tính</span>}</td>
                    <td>{x.nearest ? <>{x.nearest.name}<small className="srcname">{x.nearest.sourceLabel}</small></> : <span className="muted">Chưa ghi nhận</span>}</td>
                    <td className="num">{x.nearest ? x.nearest.text : '–'}</td>
                    <td className="num">{x.score}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </details>
      <p className="src">Khoảng cách theo đường chim bay. Nguồn: OpenStreetMap {r.osm.date.split('-').reverse().join('/')}, có thể thiếu.</p>
    </section>
  );
}

// Đi lại: thanh thời gian thay cho câu chữ; tiện ích trong toà thành các ô biểu tượng.
export function TravelCard({ r }) {
  const rows = [];
  if (r.bus) rows.push({ icon: 'bus', label: 'Xe buýt', value: r.bus.text, ratio: r.bus.d / 1000, warn: r.bus.d > 600 });
  for (const t of r.commute) rows.push({ icon: 'work', label: 'Chỗ làm ở ' + t.to, value: t.km + ' km', ratio: Number(String(t.km).replace(',', '.')) / 25, warn: t.minutes > 40 });
  return (
    <section className="card c-travel" style={{ '--i': 5 }}>
      <h3>Đi lại và trong toà</h3>
      {rows.length > 0 && (
        <ul className="trips">
          {rows.map((x) => (
            <li key={x.label} className={x.warn ? 'warn' : ''}>
              <Icon name={x.icon} size={18} />
              <span className="tl">{x.label}</span>
              <b>{x.value}</b>
              <span className="track" aria-hidden="true"><span className="fill" style={{ width: Math.max(4, Math.min(100, x.ratio * 100)) + '%' }} /></span>
            </li>
          ))}
        </ul>
      )}
      {r.inside.length > 0 ? (
        <div className="inside">
          {r.inside.map((a) => <span key={a.key} className="in-t"><Icon name={INSIDE_ICON[a.key] || 'tree'} size={20} />{a.label}</span>)}
        </div>
      ) : <p className="empty">Không có tiện ích trong khuôn viên.</p>}
    </section>
  );
}
