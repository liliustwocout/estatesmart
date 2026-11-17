// Mascot “chạy đi tìm” ở khung phải trong lúc 5 Agent thẩm định (docs/KE_HOACH_MASCOT.md mục 4).
// Một dải phố mờ có 5 trạm; Mascot chạy tới trạm của Agent đang làm rồi diễn tư thế của Agent đó.
//   hunt = null | { mode: 'read' | 'run' | 'found' | 'oops' | 'leave', step: 0..4 }
import React, { useEffect, useRef, useState } from 'react';
import Mascot from '../mascot/Mascot.jsx';

// Tư thế và câu nói ở từng trạm, theo thứ tự AGENTS trong Assistant.jsx
const STOPS = [
  ['03-suy-nghi', 'Đọc nhu cầu…', 'Nhu cầu'],
  ['05-soi-tin-dang', 'Lọc tin đăng…', 'Sàng lọc'],
  ['09-ban-do', 'Xem vị trí…', 'Vị trí'],
  ['06-ong-nhom', 'Ngó đối thủ…', 'Cạnh tranh'],
  ['08-bieu-do', 'Chấm điểm…', 'Chấm điểm'],
];
export const RUN_MS = 320; // khớp với transition `left` của .hunt-m trong assistant.css

export default function Hunt({ hunt }) {
  const [at, setAt] = useState(0); // trạm Mascot đang đứng
  const [running, setRunning] = useState(false);
  const atRef = useRef(0);
  const runTimer = useRef(0);
  const lastPose = useRef(STOPS[0][0]);
  const mode = hunt ? hunt.mode : null;
  const step = hunt ? hunt.step : 0;

  // Lượt thẩm định mới: về trạm đầu, không chạy.
  useEffect(() => {
    if (mode === 'read') { clearTimeout(runTimer.current); atRef.current = 0; setAt(0); setRunning(false); }
  }, [mode]);

  // Sang bước mới: chạy tới trạm đó, tới nơi mới diễn.
  useEffect(() => {
    if (mode !== 'run' || step === atRef.current) return;
    atRef.current = step;
    setAt(step);
    setRunning(true);
    clearTimeout(runTimer.current);
    runTimer.current = setTimeout(() => setRunning(false), RUN_MS);
  }, [mode, step]);
  useEffect(() => () => clearTimeout(runTimer.current), []);

  if (!hunt) return null;
  let pose = STOPS[at][0];
  let say = mode === 'read' ? 'Bạn cần gì nhỉ?' : STOPS[at][1];
  if (running) { pose = '02-chay-tim'; say = null; }
  if (mode === 'found') { pose = '04-tim-thay'; say = 'Tìm thấy rồi!'; }
  if (mode === 'oops') { pose = '12-boi-roi'; say = 'Ơ, chưa kết nối được…'; }
  // Lúc rời đi giữ nguyên tư thế cuối (tìm thấy / bối rối), chỉ thu nhỏ về góc
  if (mode === 'leave') { pose = lastPose.current; say = null; } else lastPose.current = pose;

  return (
    <div className={'st-hunt is-' + mode} aria-hidden="true">
      <svg className="hunt-city" viewBox="0 0 600 120" preserveAspectRatio="none">
        <path d="M0 120V70h40V40h36v30h30V20h44v50h26V48h40v22h34V30h48v40h30V56h38v14h44V26h42v44h34V44h40v26h54v50z" />
      </svg>
      <ol className="hunt-road">
        {STOPS.map((s, i) => (
          <li key={s[0]} style={{ '--i': i }} className={mode === 'found' || i < at ? 'done' : i === at ? 'on' : ''}>
            <span>{s[2]}</span>
          </li>
        ))}
      </ol>
      <div className="hunt-m" style={{ '--at': at }}>
        <Mascot pose={pose} size={132} say={say} />
      </div>
    </div>
  );
}
