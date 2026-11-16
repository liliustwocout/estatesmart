// Chuyển các artboard trong design/*.dc.html thành component React (src/generated/*.jsx).
// Nguồn chuẩn là thư mục design/ trong repo: sửa trực tiếp file ở đó rồi chạy `npm run sync`.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { parseDocument } from 'htmlparser2';

const PAGES = { 'Main.dc.html': 'Main', 'Chat.dc.html': 'Chat', 'Listing.dc.html': 'Listing' };
const ROUTES = { 'Main.dc.html': '/', 'Chat.dc.html': '/tro-ly/', 'Listing.dc.html': '/mat-bang/' };
const BLOBS = {
  '88da756d7bdf21acce5e115ce122899b': 'hero3', '3517a4dd3d9a82c4b088e7f9bcd011df': 'nightSide',
  '276d08c50962e6b144b0f758c6e01add': 'side', '8cc9ac945960bf00282a323c6238a51c': 'top',
  '3e0f7e1611926dccf9bd89f3fb717e32': 'apartment-tour', 'c1d785e9fac6c74b8e90d82cae82af92': 'exterior-garden-clean',
  '16bfb5cd9c78a2ff917437809efcd6ff': 'kitchen-clean', 'e58ecc3f426d1ec53126f84a9cad47a3': 'landscape-house-clean',
  '526999b39fdb3b7b29959da9e7531ab5': 'living-room-clean', '8ed00e7c0a317aa0658bd27abce5e716': 'apartment-bedroom',
  '6ddcbe067d337696145fbae607d2da8f': 'apartment-bedroom-2', '2c6440f67701f1d1ba74d0679f8eb676': 'apartment-living',
  '75748c213ca7441c1ce9472de5d61042': 'patio-front-clean'
};
const VOID = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'source']);
const DROP_ATTRS = /^hint-/;

const fixUrls = (s) => s
  .replace(/\/_blob\/([0-9a-f]{32})/g, (m, id) => {
    if (!BLOBS[id]) throw new Error('Ảnh chưa được ánh xạ: ' + id);
    return '/images/' + BLOBS[id] + '.webp';
  })
  .replace(/([A-Za-z]+)\.dc\.html/g, (m) => ROUTES[m] ?? m);

function holeExpr(raw, scope) {
  const p = raw.trim();
  if (/^(true|false|null|-?\d+(\.\d+)?)$/.test(p)) return p;
  const head = p.split('.')[0];
  return scope.includes(head) ? p : 'v.' + p;
}

// Chuỗi có {{ }} → biểu thức JS; một hole trọn vẹn giữ nguyên kiểu giá trị.
function valueExpr(str, scope) {
  const whole = str.match(/^\s*\{\{([^}]+)\}\}\s*$/);
  if (whole) return holeExpr(whole[1], scope);
  if (!str.includes('{{')) return JSON.stringify(str);
  const parts = str.split(/\{\{([^}]+)\}\}/);
  return '`' + parts.map((s, i) => (i % 2 ? '${' + holeExpr(s, scope) + '}' : s.replace(/[`\\$]/g, '\\$&'))).join('') + '`';
}

function attrName(n) {
  if (n === 'class') return 'className';
  if (n === 'for') return 'htmlFor';
  if (n.startsWith('aria-') || n.startsWith('data-') || !n.includes('-')) return n;
  return n.replace(/-([a-z])/g, (m, c) => c.toUpperCase());
}

function attrs(el, scope) {
  const out = [];
  for (const [k, raw] of Object.entries(el.attribs)) {
    if (DROP_ATTRS.test(k)) continue;
    const val = fixUrls(raw);
    if (k === 'style') out.push(`style={css(${valueExpr(val, scope)})}`);
    else out.push(`${attrName(k)}={${valueExpr(val, scope)}}`);
  }
  return out.length ? ' ' + out.join(' ') : '';
}

function text(t, scope) {
  if (!t.trim()) return /\n/.test(t) ? '' : '{" "}';
  const s = fixUrls(t.replace(/\s+/g, ' '));
  return s.split(/\{\{([^}]+)\}\}/).map((part, i) => {
    if (i % 2) return '{' + holeExpr(part, scope) + '}';
    return part ? '{' + JSON.stringify(part) + '}' : '';
  }).join('');
}

function node(n, scope) {
  if (n.type === 'text') return text(n.data, scope);
  if (n.type !== 'tag' && n.type !== 'script' && n.type !== 'style') return '';
  const kids = () => n.children.map((c) => node(c, scope)).join('\n');
  if (n.name === 'helmet') return '';
  if (n.name === 'sc-if') {
    const inner = n.children.map((c) => node(c, scope)).join('\n');
    return `{(${valueExpr(n.attribs.value, scope)}) && (<>${inner}</>)}`;
  }
  if (n.name === 'sc-for') {
    const as = n.attribs.as || 'item';
    const inner = n.children.map((c) => node(c, [...scope, as, '$index'])).join('\n');
    return `{(${valueExpr(n.attribs.list, scope)} || []).map((${as}, $index) => (<React.Fragment key={$index}>${inner}</React.Fragment>))}`;
  }
  if (VOID.has(n.name)) return `<${n.name}${attrs(n, scope)} />`;
  return `<${n.name}${attrs(n, scope)}>${kids()}</${n.name}>`;
}

function find(n, pred) {
  if (pred(n)) return n;
  for (const c of n.children || []) { const r = find(c, pred); if (r) return r; }
  return null;
}

mkdirSync('src/generated', { recursive: true });
for (const file of readdirSync('design').filter((f) => PAGES[f])) {
  const name = PAGES[file];
  const doc = parseDocument(readFileSync('design/' + file, 'utf8'), { lowerCaseAttributeNames: false, lowerCaseTags: false, recognizeSelfClosing: true, decodeEntities: true });
  const xdc = find(doc, (n) => n.name === 'x-dc');
  const script = find(doc, (n) => n.name === 'script' && n.attribs?.type === 'text/x-dc');
  const style = find(xdc, (n) => n.name === 'style');
  const logic = fixUrls(script.children.map((c) => c.data).join(''))
    .replace('class Component extends DCLogic', `class ${name} extends React.Component`);
  const jsx = xdc.children.map((c) => node(c, [])).join('\n');
  writeFileSync(`src/generated/${name}.css`, style ? fixUrls(style.children.map((c) => c.data).join('')) : '');
  writeFileSync(`src/generated/${name}.jsx`,
`// Tự sinh từ design/${file} bởi scripts/dc2jsx.mjs — không sửa tay.
import React from 'react';
import { css } from '../css.js';
import './${name}.css';

${logic.trim()}

${name}.prototype.render = function render() {
  const v = this.renderVals();
  return (<>${jsx}</>);
};

export default ${name};
`);
  console.log('sync', file, '→', `src/generated/${name}.jsx`);
}
