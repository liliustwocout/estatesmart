"""Sinh bộ SVG Mascot (2 bảng màu) + poses.js cho trang xem trước."""
import json, re, sys
from pathlib import Path

OUT = Path(sys.argv[1])

STYLE = """
*{transform-box:view-box}
.fb{transform-box:fill-box;transform-origin:center}
.flt{animation:flt 3.2s ease-in-out infinite}@keyframes flt{50%{transform:translateY(-5px)}}
.blk{animation:blk 4s infinite;transform-origin:80px 92px}@keyframes blk{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
.wave{animation:wave 1.1s ease-in-out infinite;transform-origin:104px 132px}@keyframes wave{50%{transform:rotate(-22deg)}}
.legL{animation:leg .36s ease-in-out infinite alternate;transform-origin:68px 152px}
.legR{animation:leg .36s ease-in-out infinite alternate-reverse;transform-origin:92px 152px}
@keyframes leg{from{transform:rotate(28deg)}to{transform:rotate(-28deg)}}
.bob{animation:bob .36s ease-in-out infinite alternate}@keyframes bob{to{transform:translateY(-4px)}}
.ground{stroke-dasharray:10 12;animation:gr .5s linear infinite}@keyframes gr{to{stroke-dashoffset:22}}
.jump{animation:jump 1s cubic-bezier(.3,1.6,.6,1) infinite}@keyframes jump{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-12px)}}
.sweep{animation:sweep 1.6s ease-in-out infinite;transform-origin:103px 132px}@keyframes sweep{50%{transform:rotate(14deg)}}
.scan{animation:scan 2.4s ease-in-out infinite;transform-origin:80px 150px}@keyframes scan{25%{transform:rotate(-7deg)}75%{transform:rotate(7deg)}}
.tape{animation:tape 2s ease-in-out infinite;transform-origin:42px 162px}@keyframes tape{0%{transform:scaleX(.1)}60%,100%{transform:scaleX(1)}}
.bar{animation:bar 2.2s ease-out infinite;transform-box:fill-box;transform-origin:bottom}@keyframes bar{0%{transform:scaleY(0)}40%,100%{transform:scaleY(1)}}
.drop{animation:drop 2s cubic-bezier(.3,1.5,.6,1) infinite}@keyframes drop{0%{transform:translateY(-34px);opacity:0}30%,100%{transform:translateY(0);opacity:1}}
.dot{animation:dot 1.2s infinite}@keyframes dot{0%,20%{opacity:.2}40%,100%{opacity:1}}
.talk{animation:talk .28s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:center}@keyframes talk{to{transform:scaleY(.35)}}
.tw{animation:tw 1.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}@keyframes tw{50%{transform:scale(.4);opacity:.4}}
.hrt{animation:hrt 1.8s ease-out infinite}@keyframes hrt{0%{transform:translateY(8px);opacity:0}30%{opacity:1}100%{transform:translateY(-22px);opacity:0}}
.sq{animation:sq .9s ease-in-out infinite;transform-origin:80px 176px}@keyframes sq{50%{transform:scale(1.04,.95)}}
.wob{animation:wob 1s ease-in-out infinite;transform-origin:80px 178px}@keyframes wob{25%{transform:rotate(-6deg)}75%{transform:rotate(6deg)}}
.spin{animation:spin 1s linear infinite;transform-box:fill-box;transform-origin:center}@keyframes spin{to{transform:rotate(360deg)}}
.swing{animation:swing .5s ease-in-out infinite alternate;transform-origin:80px 150px}@keyframes swing{from{transform:rotate(-14deg)}to{transform:rotate(14deg)}}
.lift{animation:lift 1.2s ease-in-out infinite}@keyframes lift{50%{transform:translateY(-6px)}}
.br{animation:br 2.6s ease-in-out infinite;transform-origin:80px 176px}@keyframes br{50%{transform:scaleY(1.03)}}
.zz{animation:zz 2.6s ease-out infinite}@keyframes zz{0%{transform:translate(0,6px);opacity:0}30%{opacity:1}100%{transform:translate(10px,-24px);opacity:0}}
.scr{animation:scr .3s ease-in-out infinite alternate}@keyframes scr{to{transform:translateY(-4px)}}
.drip{animation:drip 1.6s ease-in infinite}@keyframes drip{0%{transform:translateY(0);opacity:1}100%{transform:translateY(16px);opacity:0}}
.cf{animation:cf 1.8s linear infinite}@keyframes cf{0%{transform:translateY(-10px) rotate(0);opacity:0}15%{opacity:1}100%{transform:translateY(60px) rotate(220deg);opacity:0}}
.cheer{animation:cheer .6s ease-in-out infinite alternate}@keyframes cheer{to{transform:translateY(-6px)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
""".strip()

# ---- Bộ phận dùng chung (màu gốc; bảng màu thương hiệu thay ở bước cuối) ----
P = {}
P['lg'] = '<rect x="62" y="150" width="12" height="20" rx="6" fill="#111a24"/><ellipse cx="67" cy="171" rx="10" ry="5.5" fill="#111a24"/><rect x="86" y="150" width="12" height="20" rx="6" fill="#111a24"/><ellipse cx="93" cy="171" rx="10" ry="5.5" fill="#111a24"/>'
P['legs'] = '<rect x="62" y="150" width="12" height="20" rx="6" fill="#111a24"/><ellipse cx="67" cy="171" rx="10" ry="5.5" fill="#111a24"/>'
P['legs2'] = '<rect x="86" y="150" width="12" height="20" rx="6" fill="#111a24"/><ellipse cx="93" cy="171" rx="10" ry="5.5" fill="#111a24"/>'
P['bd'] = '<rect x="54" y="120" width="52" height="40" rx="17" fill="#2c6ab0"/><circle cx="80" cy="141" r="7" fill="#ffffff"/><circle cx="80" cy="141" r="2.6" fill="#e07b3c"/>'
P['hd'] = ('<path d="M80 32 L126 68 Q132 72 132 80 L132 112 Q132 126 118 126 L42 126 Q28 126 28 112 L28 80 Q28 72 34 68 Z" fill="#1d2d3f"/>'
           '<path d="M22 74 L80 28 L138 74" fill="none" stroke="#e07b3c" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>'
           '<path d="M80 8 c-6.5 0 -11 4.8 -11 10.5 c0 7.5 11 15 11 15 s11 -7.5 11 -15 c0 -5.7 -4.5 -10.5 -11 -10.5z" fill="#e07b3c"/><circle cx="80" cy="18.5" r="4" fill="#ffffff"/>'
           '<rect x="40" y="74" width="80" height="44" rx="16" fill="#0b121b"/>'
           '<ellipse cx="51" cy="109" rx="5" ry="3" fill="#e07b3c" opacity=".55"/><ellipse cx="109" cy="109" rx="5" ry="3" fill="#e07b3c" opacity=".55"/>')
P['eN'] = '<g class="eyes"><g class="blk"><rect x="57" y="83" width="11" height="17" rx="5.5" fill="#8fd0ff"/><rect x="92" y="83" width="11" height="17" rx="5.5" fill="#8fd0ff"/><circle cx="64.5" cy="87.5" r="2" fill="#ffffff"/><circle cx="99.5" cy="87.5" r="2" fill="#ffffff"/></g></g>'
P['eH'] = '<g class="eyes" fill="none" stroke="#8fd0ff" stroke-width="4" stroke-linecap="round"><path d="M57 95 Q62.5 85 68 95"/><path d="M92 95 Q97.5 85 103 95"/></g>'
P['eS'] = '<g fill="none" stroke="#8fd0ff" stroke-width="3.5" stroke-linecap="round"><path d="M57 91 Q62.5 97 68 91"/><path d="M92 91 Q97.5 97 103 91"/></g>'
P['eW'] = '<g class="eyes"><circle cx="62.5" cy="91" r="8" fill="#8fd0ff"/><circle cx="97.5" cy="91" r="8" fill="#8fd0ff"/><circle cx="62.5" cy="92" r="3" fill="#0b121b"/><circle cx="97.5" cy="92" r="3" fill="#0b121b"/><circle cx="65" cy="88" r="1.8" fill="#ffffff"/><circle cx="100" cy="88" r="1.8" fill="#ffffff"/></g>'
P['eK'] = '<g class="eyes"><rect x="57" y="83" width="11" height="17" rx="5.5" fill="#8fd0ff"/><circle cx="64.5" cy="87.5" r="2" fill="#ffffff"/><path d="M92 95 Q97.5 85 103 95" fill="none" stroke="#8fd0ff" stroke-width="4" stroke-linecap="round"/></g>'
P['mS'] = '<path d="M74 108 Q80 113 86 108" fill="none" stroke="#e07b3c" stroke-width="3" stroke-linecap="round"/>'
P['mD'] = '<path d="M72 106 Q80 118 88 106 Z" fill="#e07b3c" stroke="#e07b3c" stroke-width="2" stroke-linejoin="round"/>'
P['mO'] = '<ellipse cx="80" cy="109" rx="4" ry="4.5" fill="#e07b3c"/>'
P['mW'] = '<path d="M71 109 q2.25 -3 4.5 0 q2.25 3 4.5 0 q2.25 -3 4.5 0 q2.25 3 4.5 0" fill="none" stroke="#e07b3c" stroke-width="2.6" stroke-linecap="round"/>'
P['aL'] = '<path d="M57 130 Q44 138 42 150" fill="none" stroke="#111a24" stroke-width="8" stroke-linecap="round"/><circle cx="42" cy="152" r="6.5" fill="#ffffff" stroke="#111a24" stroke-width="3"/>'
P['aR'] = '<path d="M103 130 Q116 138 118 150" fill="none" stroke="#111a24" stroke-width="8" stroke-linecap="round"/><circle cx="118" cy="152" r="6.5" fill="#ffffff" stroke="#111a24" stroke-width="3"/>'
P['sh'] = '<ellipse cx="80" cy="182" rx="36" ry="5" fill="#000001" opacity=".14"/>'
P['hrt'] = '<path d="M0 3 C0 -1 6 -1 6 3 C6 -1 12 -1 12 3 C12 7 6 11 6 11 C6 11 0 7 0 3Z" fill="#e07b3c"/>'
P['z'] = '<path d="M0 0 h9 l-9 10 h9" fill="none" stroke="#2c6ab0" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'

HAND = lambda x, y: f'<circle cx="{x}" cy="{y}" r="6.5" fill="#ffffff" stroke="#111a24" stroke-width="3"/>'
ARM = lambda d: f'<path d="{d}" fill="none" stroke="#111a24" stroke-width="8" stroke-linecap="round"/>'

# ---- Tư thế: (tên file, tên hiển thị, dùng ở đâu, nội dung) ----
POSES = [
 ('00-dung-yen', 'Đứng yên', 'Mặc định, nổi bồng bềnh',
  '<use href="#sh"/><g class="flt"><use href="#lg"/><use href="#bd"/><use href="#aL"/><use href="#aR"/><use href="#hd"/><use href="#eN"/><use href="#mS"/></g>'),
 ('01-chao', 'Chào', 'Hero, mở khung chat',
  '<use href="#sh"/><use href="#lg"/><use href="#bd"/><use href="#aL"/><g class="wave">' + ARM('M103 130 Q120 122 124 104') + HAND(125, 100) + '</g><use href="#hd"/><use href="#eN"/><use href="#mS"/>'),
 ('02-chay-tim', 'Chạy tìm', 'Lúc chờ phản hồi',
  '<line x1="0" y1="178" x2="160" y2="178" stroke="#c3ceda" stroke-width="3" class="ground"/><g stroke="#c3ceda" stroke-width="3" stroke-linecap="round"><line x1="6" y1="96" x2="20" y2="96"/><line x1="2" y1="116" x2="18" y2="116"/><line x1="8" y1="136" x2="20" y2="136"/></g>'
  '<g class="bob"><g transform="rotate(7 80 150)"><g class="legL"><use href="#legs"/></g><g class="legR"><use href="#legs2"/></g><use href="#bd"/><use href="#aL"/>'
  + ARM('M103 130 Q118 136 126 132') + '<line x1="128" y1="130" x2="134" y2="122" stroke="#111a24" stroke-width="5" stroke-linecap="round"/><circle cx="141" cy="113" r="11" fill="#dff0ff" stroke="#111a24" stroke-width="4"/>' + HAND(127, 132)
  + '<use href="#hd"/><g transform="translate(4 0)"><use href="#eN"/></g><use href="#mS"/></g></g>'),
 ('03-suy-nghi', 'Suy nghĩ', 'Phân tích, so sánh',
  '<use href="#sh"/><use href="#lg"/><use href="#bd"/><use href="#aR"/><use href="#hd"/><g transform="translate(5 -4)"><use href="#eN"/></g><use href="#mS"/>'
  + ARM('M57 130 Q50 126 58 122') + HAND(60, 121)
  + '<circle cx="116" cy="30" r="5" fill="#2c6ab0" class="dot" style="animation-delay:-.2s"/><circle cx="130" cy="30" r="5" fill="#2c6ab0" class="dot"/><circle cx="144" cy="30" r="5" fill="#2c6ab0" class="dot" style="animation-delay:.2s"/>'),
 ('04-tim-thay', 'Tìm thấy', 'Có kết quả',
  '<use href="#sh"/><g class="jump"><use href="#lg"/><use href="#bd"/><use href="#aL"/>' + ARM('M103 130 Q122 120 128 100')
  + '<path d="M138 50 c-8 0 -13 6 -13 13 c0 9 13 19 13 19 s13 -10 13 -19 c0 -7 -5 -13 -13 -13z" fill="#e07b3c"/><circle cx="138" cy="63" r="5" fill="#ffffff"/>' + HAND(128, 97)
  + '<use href="#hd"/><use href="#eN"/><use href="#mD"/></g><path class="tw" d="M20 40 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#e07b3c"/><path class="tw" style="animation-delay:.4s" d="M150 20 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#2c6ab0"/>'),
 ('05-soi-tin-dang', 'Soi tin đăng', 'Soi tin rao, ảnh đẹp thực tế sao?',
  '<use href="#sh"/><use href="#lg"/><use href="#bd"/><use href="#hd"/><g transform="translate(0 4)"><use href="#eN"/></g><path d="M75 110 L85 110" stroke="#e07b3c" stroke-width="3" stroke-linecap="round"/>'
  '<rect x="48" y="126" width="48" height="38" rx="3" fill="#ffffff" stroke="#c3ceda" stroke-width="1.5"/><g stroke="#c9d3dd" stroke-width="3" stroke-linecap="round"><line x1="54" y1="135" x2="88" y2="135"/><line x1="54" y1="142" x2="82" y2="142"/><line x1="54" y1="149" x2="86" y2="149"/><line x1="54" y1="156" x2="72" y2="156"/></g>'
  + ARM('M57 132 Q46 146 50 156') + HAND(50, 158)
  + '<g class="sweep">' + ARM('M103 132 Q114 146 108 156') + '<line x1="94" y1="149" x2="106" y2="157" stroke="#111a24" stroke-width="5" stroke-linecap="round"/><circle cx="86" cy="142" r="9" fill="#dff0ff" fill-opacity=".7" stroke="#111a24" stroke-width="3.5"/>' + HAND(108, 158) + '</g>'),
 ('06-ong-nhom', 'Ống nhòm', 'Nhìn quanh tìm tiện ích',
  '<use href="#sh"/><use href="#lg"/><use href="#bd"/><g class="scan"><use href="#hd"/><ellipse cx="80" cy="110" rx="3" ry="2.5" fill="#e07b3c"/>'
  '<rect x="58" y="87" width="44" height="10" rx="4" fill="#111a24"/><circle cx="62.5" cy="92" r="11" fill="#111a24"/><circle cx="97.5" cy="92" r="11" fill="#111a24"/><circle cx="62.5" cy="92" r="6.5" fill="#8fd0ff"/><circle cx="97.5" cy="92" r="6.5" fill="#8fd0ff"/><circle cx="65" cy="89" r="2" fill="#ffffff"/><circle cx="100" cy="89" r="2" fill="#ffffff"/>'
  + ARM('M57 130 Q44 118 54 104') + ARM('M103 130 Q116 118 106 104') + HAND(54, 103) + HAND(106, 103) + '</g>'),
 ('07-do-dac', 'Đo đạc', 'Diện tích căn, phút đi bộ',
  '<use href="#sh"/><use href="#lg"/><use href="#bd"/><use href="#aR"/><use href="#hd"/><g transform="translate(-4 3)"><use href="#eN"/></g><use href="#mS"/>'
  '<g class="tape"><rect x="42" y="160" width="112" height="6" fill="#f2c94c"/><g stroke="#111a24" stroke-width="1.2">'
  + ''.join(f'<line x1="{x}" y1="160" x2="{x}" y2="{163 + (i % 2)}"/>' for i, x in enumerate(range(52, 150, 10)))
  + '</g><rect x="150" y="156" width="5" height="12" rx="1.5" fill="#111a24"/></g><rect x="22" y="146" width="22" height="22" rx="6" fill="#e07b3c"/><circle cx="33" cy="157" r="4.5" fill="#ffffff"/>'
  + ARM('M57 132 Q44 140 40 148') + HAND(39, 150)),
 ('08-bieu-do', 'Trình bày dữ liệu', 'Điểm sống, điểm từng nhóm tiện ích',
  '<use href="#sh"/><use href="#lg"/><use href="#bd"/><use href="#aL"/><use href="#hd"/><g transform="translate(4 -2)"><use href="#eN"/></g><use href="#mD"/>'
  '<line x1="138" y1="106" x2="138" y2="176" stroke="#c3ceda" stroke-width="3"/><rect x="116" y="56" width="42" height="50" rx="4" fill="#ffffff" stroke="#c3ceda" stroke-width="1.5"/>'
  '<rect x="122" y="86" width="7" height="14" fill="#9dbee3" class="bar"/><rect x="133" y="76" width="7" height="24" fill="#2c6ab0" class="bar" style="animation-delay:.15s"/><rect x="144" y="66" width="7" height="34" fill="#e07b3c" class="bar" style="animation-delay:.3s"/>'
  + ARM('M103 130 Q120 124 120 112') + HAND(120, 109)),
 ('09-ban-do', 'Mở bản đồ', 'Vòng 15 phút đi bộ',
  '<use href="#sh"/><use href="#lg"/><use href="#bd"/><use href="#hd"/><g transform="translate(0 4)"><use href="#eW"/></g><use href="#mO"/>'
  '<path d="M32 124 L58 130 L84 122 L110 130 L130 124 L130 162 L110 168 L84 160 L58 168 L32 162 Z" fill="#dce8f5" stroke="#9dbee3" stroke-width="1.5" stroke-linejoin="round"/>'
  '<g stroke="#9dbee3" stroke-width="1.2"><line x1="58" y1="130" x2="58" y2="168"/><line x1="84" y1="122" x2="84" y2="160"/><line x1="110" y1="130" x2="110" y2="168"/></g><path d="M36 154 Q70 136 126 142" fill="none" stroke="#ffffff" stroke-width="4"/>'
  '<g class="drop"><path d="M92 130 c-5 0 -8 3.6 -8 8 c0 5.6 8 11 8 11 s8 -5.4 8 -11 c0 -4.4 -3 -8 -8 -8z" fill="#e07b3c"/><circle cx="92" cy="138" r="3" fill="#ffffff"/></g>'
  + ARM('M57 130 Q38 128 32 138') + ARM('M103 130 Q122 128 130 138') + HAND(32, 141) + HAND(130, 141)),
 ('10-ngon-cai', 'Giơ ngón cái', 'CTA bắt đầu tư vấn',
  '<use href="#sh"/><use href="#lg"/><use href="#bd"/><use href="#aL"/><use href="#hd"/><use href="#eK"/><use href="#mD"/>'
  + ARM('M103 130 Q122 124 126 106') + '<rect x="123" y="86" width="7" height="13" rx="3.5" fill="#ffffff" stroke="#111a24" stroke-width="3"/><circle cx="127" cy="102" r="7.5" fill="#ffffff" stroke="#111a24" stroke-width="3"/>'
  '<path class="tw" d="M146 70 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z" fill="#e07b3c"/><path class="tw" style="animation-delay:.5s" d="M14 50 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#2c6ab0"/>'),
 ('11-dang-tra-loi', 'Đang trả lời', 'Chữ hiện dần, miệng mấp máy',
  '<use href="#sh"/><use href="#lg"/><use href="#bd"/><use href="#aR"/><use href="#hd"/><use href="#eN"/><ellipse cx="80" cy="109" rx="5" ry="4.5" fill="#e07b3c" class="talk"/>'
  + ARM('M57 130 Q42 126 38 112') + HAND(37, 109)
  + '<path d="M118 38 L110 50 L130 38 Z" fill="#ffffff" stroke="#c3ceda" stroke-width="1.5" stroke-linejoin="round"/><rect x="104" y="8" width="52" height="31" rx="14" fill="#ffffff" stroke="#c3ceda" stroke-width="1.5"/><rect x="114" y="37" width="14" height="3" fill="#ffffff"/>'
  '<circle cx="118" cy="23.5" r="3.2" fill="#2c6ab0" class="dot"/><circle cx="130" cy="23.5" r="3.2" fill="#2c6ab0" class="dot" style="animation-delay:.2s"/><circle cx="142" cy="23.5" r="3.2" fill="#2c6ab0" class="dot" style="animation-delay:.4s"/>'),
 ('12-boi-roi', 'Bối rối', 'Lỗi mạng, không tìm thấy căn',
  '<use href="#sh"/><use href="#lg"/><use href="#bd"/><use href="#aL"/><use href="#hd"/><g transform="translate(-3 0)"><use href="#eN"/></g><use href="#mW"/>'
  '<g class="scr">' + ARM('M103 130 Q132 122 134 96') + HAND(134, 92) + '</g>'
  '<g transform="translate(20 64)"><path class="drip" d="M0 0 C3 5 5 8 5 10 a5 5 0 0 1 -10 0 C-5 8 -3 5 0 0Z" fill="#8fd0ff"/></g>'),
 ('13-an-mung', 'Ăn mừng', 'Đã lưu hồ sơ, đặt lịch xem nhà xong',
  '<use href="#sh"/><g class="cheer"><use href="#lg"/><use href="#bd"/>' + ARM('M57 130 Q32 124 24 98') + ARM('M103 130 Q128 124 136 98') + HAND(24, 95) + HAND(136, 95)
  + '<use href="#hd"/><use href="#eH"/><use href="#mD"/></g>'
  '<rect class="cf" x="20" y="10" width="6" height="10" fill="#e07b3c"/><rect class="cf" style="animation-delay:.5s" x="130" y="6" width="6" height="10" fill="#2c6ab0"/><rect class="cf" style="animation-delay:.9s" x="104" y="2" width="5" height="8" fill="#f2c94c"/><rect class="cf" style="animation-delay:1.3s" x="44" y="4" width="5" height="8" fill="#2e7d5b"/>'),
 ('14-duoc-vuot', 'Được vuốt', 'Rê chuột qua lại trên đầu',
  '<use href="#sh"/><g class="sq"><use href="#lg"/><use href="#bd"/><use href="#aL"/><use href="#aR"/><use href="#hd"/><ellipse cx="51" cy="108" rx="6" ry="3.5" fill="#f08a5d"/><ellipse cx="109" cy="108" rx="6" ry="3.5" fill="#f08a5d"/><use href="#eH"/><use href="#mD"/></g>'
  '<g transform="translate(128 40)"><use href="#hrt" class="hrt"/></g><g transform="translate(18 56)"><use href="#hrt" class="hrt" style="animation-delay:.8s"/></g>'),
 ('15-chong-mat', 'Chóng mặt', 'Bấm liên tục 5 lần',
  '<use href="#sh"/><g class="wob"><use href="#lg"/><use href="#bd"/><use href="#aL"/><use href="#aR"/><use href="#hd"/><g fill="none" stroke="#8fd0ff" stroke-width="2.6" stroke-linecap="round">'
  '<path class="spin" d="M62.5 91.5 m-1 0 a1 1 0 1 1 2 0 a2.5 2.5 0 1 1 -5 0 a4 4 0 1 1 8 0 a5.5 5.5 0 1 1 -11 0"/><path class="spin" d="M97.5 91.5 m-1 0 a1 1 0 1 1 2 0 a2.5 2.5 0 1 1 -5 0 a4 4 0 1 1 8 0 a5.5 5.5 0 1 1 -11 0"/></g><use href="#mW"/></g>'
  '<g transform="translate(80 12) scale(1 .38)"><g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="1.4s" repeatCount="indefinite"/>'
  '<path d="M-36 -5 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#f2c94c"/><path d="M36 -5 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#e07b3c"/><path d="M0 -40 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#2c6ab0"/></g></g>'),
 ('16-bi-nhac-len', 'Bị nhấc lên', 'Kéo thả mascot',
  '<ellipse cx="80" cy="182" rx="24" ry="4" fill="#000001" opacity=".08"/><g class="lift"><g transform="translate(0 -6)"><g class="swing"><use href="#lg"/></g><use href="#bd"/>'
  + ARM('M57 130 Q36 120 30 102') + ARM('M103 130 Q124 120 130 102') + HAND(30, 99) + HAND(130, 99) + '<use href="#hd"/><use href="#eW"/><use href="#mO"/></g></g>'),
 ('17-ngu-gat', 'Ngủ gật', '30 giây không ai đụng tới',
  '<use href="#sh"/><g class="br"><use href="#lg"/><use href="#bd"/><use href="#aL"/><use href="#aR"/><use href="#hd"/><use href="#eS"/><circle cx="80" cy="109" r="2.4" fill="#e07b3c"/></g>'
  '<g transform="translate(118 44)"><use href="#z" class="zz"/></g><g transform="translate(130 28) scale(.75)"><use href="#z" class="zz" style="animation-delay:1.3s"/></g>'),
]

# Avatar: chỉ phần đầu, khung nhìn 18 0 124 132
AVATARS = [
 ('avatar', 'Avatar (chỉ đầu)', 'Avatar trong khung chat, favicon lớn',
  '<use href="#hd"/><use href="#eN"/><use href="#mS"/>'),
 ('avatar-noi', 'Avatar đang nói', 'Avatar khung chat khi câu trả lời đang hiện',
  '<use href="#hd"/><use href="#eN"/><ellipse cx="80" cy="109" rx="5" ry="4.5" fill="#e07b3c" class="talk"/>'),
]
VB = lambda slug: '18 0 124 132' if slug.startswith('avatar') else '0 0 160 190'

CONCEPTS = {
 'y-tuong-a-dau-ngoi-nha': '<use href="#sh"/><g class="flt"><use href="#lg"/><use href="#bd"/><use href="#aL"/><use href="#aR"/><use href="#hd"/><use href="#eN"/><use href="#mS"/></g>',
 'y-tuong-b-ghim-ban-do': '<ellipse cx="80" cy="182" rx="30" ry="5" fill="#000001" opacity=".14"/><g class="flt"><rect x="66" y="132" width="10" height="38" rx="5" fill="#111a24"/><rect x="84" y="132" width="10" height="38" rx="5" fill="#111a24"/><ellipse cx="70" cy="171" rx="9" ry="5" fill="#111a24"/><ellipse cx="90" cy="171" rx="9" ry="5" fill="#111a24"/><path d="M38 98 Q26 110 28 124" fill="none" stroke="#111a24" stroke-width="7" stroke-linecap="round"/><circle cx="28" cy="126" r="6" fill="#ffffff" stroke="#111a24" stroke-width="3"/><path d="M122 98 Q134 110 132 124" fill="none" stroke="#111a24" stroke-width="7" stroke-linecap="round"/><circle cx="132" cy="126" r="6" fill="#ffffff" stroke="#111a24" stroke-width="3"/><path d="M80 26 C50 26 32 48 32 76 C32 108 80 150 80 150 C80 150 128 108 128 76 C128 48 110 26 80 26Z" fill="#2c6ab0"/><path d="M58 36 L80 18 L102 36" fill="none" stroke="#e07b3c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="80" cy="78" rx="34" ry="24" fill="#0b121b"/><g class="blk" style="transform-origin:80px 75px"><rect x="63" y="68" width="10" height="15" rx="5" fill="#8fd0ff"/><rect x="87" y="68" width="10" height="15" rx="5" fill="#8fd0ff"/></g><path d="M75 92 Q80 96 85 92" fill="none" stroke="#e07b3c" stroke-width="3" stroke-linecap="round"/></g>',
 'y-tuong-c-o-vuong': '<ellipse cx="80" cy="182" rx="32" ry="5" fill="#000001" opacity=".14"/><g class="flt"><rect x="62" y="118" width="12" height="52" rx="6" fill="#111a24"/><rect x="86" y="118" width="12" height="52" rx="6" fill="#111a24"/><ellipse cx="67" cy="171" rx="10" ry="5.5" fill="#111a24"/><ellipse cx="93" cy="171" rx="10" ry="5.5" fill="#111a24"/><path d="M36 96 Q24 108 26 122" fill="none" stroke="#111a24" stroke-width="8" stroke-linecap="round"/><circle cx="26" cy="124" r="6.5" fill="#ffffff" stroke="#111a24" stroke-width="3"/><path d="M124 96 Q136 108 134 122" fill="none" stroke="#111a24" stroke-width="8" stroke-linecap="round"/><circle cx="134" cy="124" r="6.5" fill="#ffffff" stroke="#111a24" stroke-width="3"/><rect x="34" y="34" width="92" height="92" rx="32" fill="#1d2d3f"/><path d="M54 80 L80 56 L106 80" fill="none" stroke="#9dbee3" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><g class="blk" style="transform-origin:80px 90px"><rect x="66" y="84" width="8" height="12" rx="4" fill="#ffffff"/><rect x="86" y="84" width="8" height="12" rx="4" fill="#ffffff"/></g><ellipse cx="80" cy="108" rx="6" ry="3.5" fill="#e07b3c"/><path d="M114 38 c.6 4 2.6 6 6.6 6.6 -4 .6 -6 2.6 -6.6 6.6 -.6 -4 -2.6 -6 -6.6 -6.6 4 -.6 6 -2.6 6.6 -6.6Z" fill="#ffffff"/></g>',
}

# Bảng màu thương hiệu estateSmartAI (nền tối ấm, nhấn cam đất #D39A6A)
BRAND = {
 '#1d2d3f': '#F4EFE6',  # đầu: kem
 '#0b121b': '#1F1C19',  # màn hình mặt: mực
 '#8fd0ff': '#F0B98A',  # mắt: cam đất sáng
 '#e07b3c': '#D39A6A',  # mái, ghim, miệng, má
 '#2c6ab0': '#8C6A52',  # thân, điểm nhấn phụ: nâu ca cao
 '#111a24': '#CFC6B8',  # tay chân: kem đậm (nổi trên nền tối)
 '#000001': '#000000',  # bóng đổ
 '#dff0ff': '#F4EFE6', '#dce8f5': '#E9DFCF', '#9dbee3': '#B9A68E',
 '#c3ceda': '#6E655C', '#c9d3dd': '#D8CFC2', '#f08a5d': '#E08A6A',
}

USE = re.compile(r'<use href="#(\w+)"((?: class="[^"]*")?(?: style="[^"]*")?)\s*/>')

def inline(body: str) -> str:
    # Thay <use> bằng nội dung thật → mỗi file SVG tự chứa, mở được trong Figma/Illustrator.
    for _ in range(3):
        body = USE.sub(lambda m: f'<g{m.group(2)}>{P[m.group(1)]}</g>' if m.group(2) else P[m.group(1)], body)
    return body

def svg(body: str, title: str, vb='0 0 160 190') -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="{title}">'
            f'<title>{title}</title><style>{STYLE}</style>{inline(body)}</svg>\n')

def recolor(s: str) -> str:
    return re.sub(r'#[0-9a-fA-F]{6}\b', lambda m: BRAND.get(m.group(0).lower(), m.group(0)), s)

manifest = []
for pal, fix in (('goc', lambda s: s.replace('#000001', '#111a24')), ('thuong-hieu', recolor)):
    d = OUT / pal
    d.mkdir(parents=True, exist_ok=True)
    for slug, name, use, body in POSES + AVATARS:
        vb = VB(slug)
        (d / f'{slug}.svg').write_text(fix(svg(body, f'Mascot — {name}', vb)), encoding='utf-8')
cd = OUT / 'y-tuong'
cd.mkdir(exist_ok=True)
for slug, body in CONCEPTS.items():
    (cd / f'{slug}.svg').write_text(svg(body, slug).replace('#000001', '#111a24'), encoding='utf-8')

# poses.js: chuỗi SVG nội tuyến cho trang xem trước tương tác (mở được bằng file://, không cần fetch)
data = {pal: {slug: fix(inline(body)) for slug, _, _, body in POSES}
        for pal, fix in (('goc', lambda s: s.replace('#000001', '#111a24')), ('thuong-hieu', recolor))}
meta = [{'slug': s, 'name': n, 'use': u} for s, n, u, _ in POSES + AVATARS]
(OUT / 'poses.js').write_text(
    '// Tự sinh bởi gen_mascot.py — nội dung SVG của từng tư thế cho index.html.\n'
    f'window.MASCOT_STYLE = {json.dumps(STYLE, ensure_ascii=False)};\n'
    f'window.MASCOT_POSES = {json.dumps(data, ensure_ascii=False)};\n'
    f'window.MASCOT_META = {json.dumps(meta, ensure_ascii=False)};\n', encoding='utf-8')

# ---- Đầu ra cho web (được commit, để `npm run build` không cần Python) ----
# public/mascot/*.svg: bản thương hiệu, nhúng bằng <img> (SVG tách biệt, giữ nguyên tên lớp).
# src/mascot/poses.js: chuỗi SVG cho component React. SVG nội tuyến chia chung CSS với trang,
# nên mọi lớp/keyframes được đổi sang tiền tố `m-` và `*` gói trong `.mascot-art`.
ROOT = Path(__file__).resolve().parents[2]
pub = ROOT / 'public' / 'mascot'
pub.mkdir(parents=True, exist_ok=True)
for slug, name, use, body in POSES + AVATARS:
    vb = VB(slug)
    (pub / f'{slug}.svg').write_text(recolor(svg(body, f'Mascot — {name}', vb)), encoding='utf-8')

KF = set(re.findall(r'@keyframes (\w+)', STYLE))
CLS = set(re.findall(r'\.([A-Za-z]\w*)', STYLE))

def scope_css(css: str) -> str:
    css = re.sub(r'\.([A-Za-z]\w*)', lambda m: '.m-' + m.group(1), css)
    css = re.sub(r'@keyframes (\w+)', r'@keyframes m-\1', css)
    css = re.sub(r'animation:(\w+)', lambda m: 'animation:' + ('m-' if m.group(1) in KF else '') + m.group(1), css)
    return css.replace('*{', '.mascot-art *{')

def scope_body(b: str) -> str:
    return re.sub(r'class="([^"]*)"', lambda m: 'class="' + ' '.join(('m-' + c) if c in CLS else c for c in m.group(1).split()) + '"', b)

web = {slug: scope_body(recolor(inline(body))) for slug, _, _, body in POSES + AVATARS}
web_meta = [{'slug': s, 'name': n, 'use': u, 'viewBox': VB(s)}
            for s, n, u, _ in POSES + AVATARS]
src = ROOT / 'src' / 'mascot'
src.mkdir(parents=True, exist_ok=True)
(src / 'poses.js').write_text(
    '// Tự sinh bởi design/mascot/gen_mascot.py — đừng sửa tay. Bảng màu thương hiệu, lớp CSS có tiền tố m-.\n'
    f'export const STYLE = {json.dumps(scope_css(STYLE), ensure_ascii=False)};\n'
    f'export const POSES = {json.dumps(web, ensure_ascii=False, indent=0)};\n'
    f'export const META = {json.dumps(web_meta, ensure_ascii=False)};\n', encoding='utf-8')

print('ok', len(POSES) + len(AVATARS), 'poses x 2 palettes,', len(CONCEPTS), 'concepts; web: public/mascot + src/mascot/poses.js')
