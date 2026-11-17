// Trang thử Mascot (/thu-mascot/, chỉ chạy trong dev): đủ tương tác mục 3 của docs/KE_HOACH_MASCOT.md,
// điều khiển bằng sự kiện `mascot`, và toàn bộ tư thế ở dạng tĩnh.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/interaction.css';
import Mascot, { MASCOT_POSES } from '../mascot/Mascot.jsx';

const css = `
body { margin: 0; background: #1B1916; color: #F7F3EC; font: 400 15px/1.5 'Familjen Grotesk', system-ui, sans-serif; }
.lab { max-width: 1120px; margin: 0 auto; padding: 32px 16px 64px; }
.lab h1 { font-size: 28px; margin: 0 0 4px; }
.lab h2 { font-size: 18px; margin: 40px 0 12px; }
.lab p, .lab li { color: #CFC6B8; }
.lab-top { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 340px); gap: 24px; margin-top: 24px; }
.lab-stage { position: relative; min-height: 420px; border: 1px solid rgba(247,243,236,.12); border-radius: 20px;
  background: #211E1A; display: grid; place-items: center; padding: 64px 16px 24px; overflow: hidden; }
.lab-panel { display: grid; gap: 16px; align-content: start; }
.lab-panel label { display: grid; gap: 6px; font-size: 14px; color: #CFC6B8; }
.lab select, .lab input[type=range] { width: 100%; }
.lab select { background: #262320; color: #F7F3EC; border: 1px solid rgba(247,243,236,.16); border-radius: 10px; padding: 8px; font: inherit; }
.lab-btns { display: flex; flex-wrap: wrap; gap: 8px; }
.lab button { background: #D39A6A; color: #1B1916; border: 0; border-radius: 999px; padding: 8px 14px; font: 600 14px/1 inherit; font-family: inherit; cursor: pointer; }
.lab-log { margin: 0; padding: 12px; min-height: 120px; max-height: 180px; overflow: auto; background: #262320; border-radius: 12px;
  font: 12px/1.6 ui-monospace, monospace; color: #CFC6B8; list-style: none; }
.lab-row { display: flex; align-items: center; gap: 16px; padding: 16px; border-radius: 16px; background: #211E1A; }
.lab-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.lab-card { display: grid; justify-items: center; gap: 6px; padding: 16px 8px 12px; border-radius: 16px; background: #211E1A; text-align: center; }
.lab-card b { font-size: 13px; }
.lab-card small { color: #9C9286; font-size: 12px; }
@media (max-width: 760px) { .lab-top { grid-template-columns: 1fr; } .lab-stage { min-height: 340px; } }
`;

const SEQ = {
  'Thẩm định 5 Agent': [
    ['03-suy-nghi', 1400, 'Nghe nhà mình cần gì…'], ['02-chay-tim', 700],
    ['05-soi-tin-dang', 1400, 'Lọc tin rao…'], ['02-chay-tim', 700],
    ['07-do-dac', 1400, 'Đo đường tới trường…'], ['02-chay-tim', 700],
    ['06-ong-nhom', 1400, 'Tìm chợ, công viên…'], ['02-chay-tim', 700],
    ['08-bieu-do', 1400, 'Chấm điểm sống…'], ['04-tim-thay', 1500, 'Tìm thấy rồi!'],
  ],
  'Đã lưu hồ sơ': [['13-an-mung', 2000, 'Đã lưu hồ sơ!']],
  'Lỗi mạng': [['12-boi-roi', 2000, 'Ơ, mạng lỗi rồi…']],
  'Đang trả lời': [['11-dang-tra-loi', 2400]],
};

function Lab() {
  const [rest, setRest] = useState('00-dung-yen');
  const [size, setSize] = useState(200);
  const [log, setLog] = useState([]);
  const onPose = (slug) => setLog((l) => [`${new Date().toLocaleTimeString('vi-VN')}  ${slug}`, ...l].slice(0, 40));
  const send = (play) => window.dispatchEvent(new CustomEvent('mascot', { detail: { name: 'lab', play } }));

  return (
    <main className="lab">
      <style>{css}</style>
      <h1>Thử Mascot</h1>
      <p>Trang thử trong dev cho <code>src/mascot/</code>. Không có trong bản build.</p>

      <div className="lab-top">
        <div className="lab-stage">
          <Mascot interactive name="lab" pose={rest} size={size} onPose={onPose} />
        </div>
        <div className="lab-panel">
          <label><span>Tư thế nghỉ (prop <code>pose</code>)</span>
            <select value={rest} onChange={(e) => setRest(e.target.value)}>
              {MASCOT_POSES.filter((m) => !m.slug.startsWith('avatar')).map((m) => <option key={m.slug} value={m.slug}>{m.slug} · {m.name}</option>)}
            </select>
          </label>
          <label><span>Kích thước: {size}px</span>
            <input type="range" min="96" max="280" step="8" value={size} onChange={(e) => setSize(+e.target.value)} />
          </label>
          <div>
            <p style={{ margin: '0 0 8px' }}>Sự kiện <code>mascot</code> từ trang:</p>
            <div className="lab-btns">
              {Object.entries(SEQ).map(([k, v]) => <button key={k} type="button" onClick={() => send(v)}>{k}</button>)}
            </div>
          </div>
          <ul className="lab-log" aria-label="Nhật ký tư thế">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </div>
      </div>

      <h2>Cần thử</h2>
      <ul>
        <li>Di chuột khắp trang: mắt nhìn theo. Rê qua lại trên đầu: được vuốt.</li>
        <li>Bấm một lần: chào → ăn mừng → ngón cái → tìm thấy. Bấm 5 lần trong 2 giây: chóng mặt.</li>
        <li>Kéo quá 6px: bị nhấc lên, thả ra nảy về rồi ăn mừng. Cảm ứng: giữ 400 ms rồi kéo; vuốt ngang trên đầu = vuốt.</li>
        <li>Để yên 10 giây: ống nhòm. 30 giây: ngủ gật, đụng vào là tỉnh.</li>
        <li>Tab tới Mascot, Enter / Space = bấm.</li>
      </ul>

      <h2>Avatar (chỉ mắt nhìn theo)</h2>
      <div className="lab-row">
        <Mascot pose="avatar" size={56} follow />
        <span>Avatar khung chat: <code>&lt;Mascot pose="avatar" size=&#123;56&#125; follow /&gt;</code></span>
      </div>

      <h2>Toàn bộ tư thế (tĩnh, <code>aria-hidden</code>)</h2>
      <div className="lab-grid">
        {MASCOT_POSES.map((m) => (
          <div className="lab-card" key={m.slug}>
            <Mascot pose={m.slug} size={m.slug.startsWith('avatar') ? 96 : 110} />
            <b>{m.slug}</b>
            <small>{m.use}</small>
          </div>
        ))}
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<Lab />);
