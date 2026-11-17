// Loại tiện ích dùng chung cho script tải OSM, bộ chấm điểm và trang quản trị.
export const POI_KINDS = {
  kindergarten: 'Trường mầm non', school: 'Trường phổ thông', university: 'Đại học, cao đẳng',
  market: 'Chợ', supermarket: 'Siêu thị', convenience: 'Cửa hàng tiện lợi', mall: 'Trung tâm thương mại',
  pharmacy: 'Nhà thuốc', clinic: 'Phòng khám, trạm y tế', hospital: 'Bệnh viện',
  park: 'Công viên, vườn hoa, hồ', playground: 'Sân chơi trẻ em', sports: 'Bể bơi, gym, sân thể thao',
  bus_stop: 'Điểm xe buýt', metro: 'Ga metro', food: 'Quán ăn, cà phê', apartments: 'Toà chung cư'
};
export const SCHOOL_LEVELS = { mn: 'Mầm non', th: 'Tiểu học', thcs: 'THCS', thpt: 'THPT', lc: 'Liên cấp', '': 'Chưa rõ cấp' };

// Cấp học đoán từ tên trường: mn, th, thcs, thpt, lc (liên cấp), '' chưa rõ.
export function schoolLevel(name) {
  const n = String(name || '').toLowerCase();
  if (/mầm non|mẫu giáo|mam non|kindergarten|preschool|nhà trẻ/.test(n)) return 'mn';
  if (/liên cấp|lien cap|tiểu học và trung học|th\s*-\s*thcs|thcs\s*-\s*thpt/.test(n)) return 'lc';
  if (/trung học phổ thông|thpt|high school/.test(n)) return 'thpt';
  if (/trung học cơ sở|thcs|secondary/.test(n)) return 'thcs';
  if (/tiểu học|tieu hoc|primary/.test(n)) return 'th';
  return '';
}
