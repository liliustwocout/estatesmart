// Lời dặn hệ thống cho trợ lý và dữ liệu ba mặt bằng mẫu.
// Giai đoạn 2 sẽ thay LISTINGS bằng dữ liệu đọc từ cơ sở dữ liệu.

export const LISTINGS = [
  {
    code: 'MB-01', rank: 1, score: 88, name: 'Biệt thự sân vườn ven hồ, Ngọc Trai',
    model: 'quán cà phê sân vườn', area: '300 m², hai tầng, sân vườn 110 m²', rent: '75 triệu/tháng (250.000 đ/m²), đặt cọc 3 tháng, hợp đồng tối thiểu 3 năm',
    access: 'mặt tiền 14 m, đường nội khu 13 m nhìn ra hồ, hai chiều, không có dải phân cách cứng, bãi đỗ ô tô cách 120 m, để được khoảng 25 xe máy',
    around: 'hồ Ngọc Trai 150 m; 6 toà chung cư trong 600 m; 2 trường liên cấp trong 500 m; Vincom Mega Mall 1,3 km',
    competition: '7 quán cà phê trong 500 m, phân khúc cà phê sân vườn cao cấp còn trống',
    pros: 'sân vườn rộng tạo khác biệt; ô tô dừng đỗ thuận tiện; cư dân thu nhập cao',
    cons: 'cải tạo bếp và hút mùi khoảng 150–200 triệu; ít khách giờ hành chính; hợp đồng dài'
  },
  {
    code: 'MB-02', rank: 2, score: 81, name: 'Nhà phố có sân, Hải Âu',
    model: 'quán cà phê mang đi', area: '180 m², một tầng, sân trước 60 m²', rent: '45 triệu/tháng (250.000 đ/m²), đặt cọc 2 tháng, hợp đồng tối thiểu 2 năm',
    access: 'mặt tiền 10 m trên đại lộ nội khu 30 m, có dải phân cách cứng (quay đầu cách 250 m), bãi đỗ ô tô cách 300 m, để được khoảng 20 xe máy',
    around: '8 toà chung cư trong 400 m; 2 trường đại học trong 900 m; công viên, khu thể thao 350 m; siêu thị 500 m',
    competition: '12 quán cà phê trong 500 m, cạnh tranh cao',
    pros: 'chi phí thuê thấp; sân trước tiện cho khách mang đi; gần cụm chung cư và trường đại học',
    cons: 'dải phân cách cứng; mật độ đối thủ cao; ít chỗ đỗ ô tô'
  },
  {
    code: 'MB-03', rank: 3, score: 76, name: 'Shophouse căn góc, San Hô',
    model: 'nhà hàng có phòng riêng', area: '240 m², hai tầng, hai phòng riêng', rent: '62 triệu/tháng (258.000 đ/m², cao hơn khu vực khoảng 8%), đặt cọc 3 tháng, hợp đồng tối thiểu 3 năm',
    access: 'căn góc hai mặt tiền 8 m và 18 m, mặt 18 m là đường một chiều, không có dải phân cách cứng, bãi đỗ ô tô cách 180 m, để được khoảng 30 xe máy',
    around: 'Vincom Mega Mall 700 m; 5 toà chung cư trong 450 m; 2 khách sạn, căn hộ dịch vụ trong 600 m; trung tâm Hà Nội khoảng 15 km',
    competition: '9 nhà hàng trong 500 m, thiếu nhà hàng có phòng riêng',
    pros: 'nhận diện tốt từ hai hướng; có phòng riêng tiếp khách; gần trung tâm thương mại',
    cons: 'đơn giá cao hơn khu vực; mặt đường lớn là một chiều; bếp cần cải tạo thoát khói'
  }
];

const CRITERIA_LABELS = { model: 'Mô hình kinh doanh', area: 'Khu vực', budget: 'Ngân sách thuê', size: 'Diện tích', needs: 'Yêu cầu vận hành' };

export function systemPrompt(criteria = {}) {
  const crit = Object.entries(CRITERIA_LABELS)
    .map(([k, label]) => `- ${label}: ${String(criteria[k] || 'chưa rõ').slice(0, 120)}`)
    .join('\n');
  const listings = LISTINGS.map((l) => [
    `${l.code} (hạng ${l.rank}, ${l.score}/100 điểm): ${l.name}, Vinhomes Ocean Park 1, Gia Lâm, Hà Nội`,
    `  Phù hợp: ${l.model}. Diện tích: ${l.area}. Giá thuê: ${l.rent}.`,
    `  Tiếp cận: ${l.access}.`,
    `  Xung quanh: ${l.around}.`,
    `  Cạnh tranh: ${l.competition}.`,
    `  Ưu điểm: ${l.pros}. Rủi ro: ${l.cons}.`
  ].join('\n')).join('\n');

  return `Bạn là trợ lý thẩm định mặt bằng kinh doanh của estateSmartAI, hỗ trợ chủ quán F&B và bán lẻ nhỏ ở Hà Nội.
Người dùng đã trả lời 5 câu hỏi và hệ thống đã đề xuất ba mặt bằng dưới đây. Hãy trả lời câu hỏi tiếp theo của họ.

Tiêu chí người dùng:
${crit}

Ba mặt bằng đã đề xuất (dữ liệu mô phỏng, chỉ để minh hoạ):
${listings}

Quy tắc:
- Trả lời bằng tiếng Việt, xưng "tôi", gọi người dùng là "anh/chị".
- Ngắn gọn, tối đa khoảng 120 từ. Viết chữ thường, không dùng Markdown (không **, #, bảng). Được xuống dòng và dùng gạch đầu dòng "- ".
- Chỉ dùng số liệu có ở trên. Nếu không có dữ liệu, nói rõ là chưa có và gợi ý đi khảo sát thực địa. Không bịa số liệu, địa chỉ hay tên đối thủ.
- Nhắc rằng đây là dữ liệu mô phỏng khi người dùng hỏi về quyết định thuê, giá cả hay pháp lý.
- Không tư vấn đầu tư tài chính, không hứa hẹn doanh thu.
- Không xin và không ghi nhận họ tên, số điện thoại hay thông tin cá nhân; nếu họ muốn đặt lịch, hướng dẫn bấm "Xem hồ sơ" rồi "Đặt lịch khảo sát".
- Từ chối lịch sự các câu hỏi không liên quan đến tìm và đánh giá mặt bằng kinh doanh.`;
}
