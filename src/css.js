// Chuyển chuỗi style kiểu HTML ("a: b; c: d") thành object style của React.
const cache = new Map();

export function css(str) {
  if (!str) return undefined;
  let out = cache.get(str);
  if (out) return out;
  out = {};
  for (const decl of str.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    const value = decl.slice(i + 1).trim();
    if (!prop || !value) continue;
    const key = prop.startsWith('--') ? prop : prop.replace(/-([a-z])/g, (m, c) => c.toUpperCase());
    out[key] = value;
  }
  cache.set(str, out);
  return out;
}
