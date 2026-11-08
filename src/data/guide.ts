// Nội dung hướng dẫn tổng hợp từ nguồn công khai (không phải dữ liệu địa điểm). Hãy kiểm tra lại lịch lễ hội với ban tổ chức trước khi đi.
export interface Specialty { name: string; vi: string; en: string }
export interface Festival { name: string; en: string; when: string; whenEn: string; where: string; vi: string; en2: string; src: string }
export const GUIDE_CHECKED = '11/2026'

// Nguồn món ăn: https://vov.vn/du-lich/nhung-mon-ngon-nhat-dinh-phai-thu-khi-den-ha-noi-654407.vov
export const SPECIALTIES_SRC = 'https://vov.vn/du-lich/nhung-mon-ngon-nhat-dinh-phai-thu-khi-den-ha-noi-654407.vov'
export const SPECIALTIES_SRC_LABEL = 'vov.vn'
export const SPECIALTIES: Specialty[] = [
  { name:'Phở', vi:'Nước dùng hầm từ xương, thịt bò tái vừa chín, bánh phở mềm dai.', en:'Bone-simmered broth, just-cooked beef and soft rice noodles.' },
  { name:'Bún thang', vi:'Gà xé, giò lụa thái sợi, trứng tráng mỏng; nước dùng trong, ngọt từ xương gà và tôm khô.', en:'Shredded chicken, silky ham and thin omelette in a clear broth sweetened with chicken bones and dried shrimp.' },
  { name:'Bánh cuốn Thanh Trì', vi:'Vỏ mỏng tráng từ bột gạo xay ướt, ăn với nước chấm, chả quế và rau thơm.', en:'Paper-thin steamed rice rolls served with dipping sauce, cinnamon sausage and herbs.' },
  { name:'Bún chả', vi:'Chả nướng than hoa, dưa góp giòn và bát nước mắm pha vừa miệng.', en:'Charcoal-grilled pork with pickled papaya and a balanced dipping broth, served with noodles.' },
  { name:'Bánh tôm Hồ Tây', vi:'Bánh làm chủ yếu từ tôm, vàng giòn, chấm nước chua ngọt.', en:'Crisp golden shrimp fritters with sweet-sour dipping sauce.' },
  { name:'Chả cá Lã Vọng', vi:'Cá lăng hoặc cá quả chiên, ăn cùng bún, rau thơm và mắm tôm.', en:'Fried fish served with noodles, herbs and fermented shrimp paste.' },
  { name:'Vịt cỏ Vân Đình', vi:'Vịt chăn thả theo lối truyền thống ở Ứng Hòa, hương vị riêng.', en:'Traditionally free-range ducks from Ung Hoa, known for their flavour.' },
  { name:'Cốm', vi:'Hạt cốm xanh gói lá sen, buộc lạt nếp; hương vị của mùa thu.', en:'Young green rice wrapped in lotus leaf — the taste of autumn.' },
]

// Nguồn lễ hội: https://vinwonders.com/vi/wonderpedia/news/le-hoi-o-ha-noi/ (ngày theo âm lịch)
const FSRC = 'https://vinwonders.com/vi/wonderpedia/news/le-hoi-o-ha-noi/'
export const FESTIVALS: Festival[] = [
  { name:'Lễ hội đền Cổ Loa', en:'Co Loa Temple Festival', when:'6–16 tháng Giêng (âm lịch)', whenEn:'6th–16th day of lunar month 1', where:'Cổ Loa, Đông Anh', vi:'Tưởng nhớ vua An Dương Vương, người lập nên nước Âu Lạc.', en2:'Honours King An Duong Vuong, founder of the Au Lac state.', src:FSRC },
  { name:'Hội Gióng Phù Đổng', en:'Giong Festival (Phu Dong)', when:'6–8 tháng Giêng (âm lịch)', whenEn:'6th–8th day of lunar month 1', where:'Phù Linh, Sóc Sơn', vi:'Tưởng nhớ Thánh Gióng với rước ngựa, tắm tượng.', en2:'Commemorates the hero Thanh Giong with a horse procession and statue-bathing rite.', src:FSRC },
  { name:'Lễ hội chùa Hương', en:'Perfume Pagoda Festival', when:'Từ 6 tháng Giêng đến cuối tháng 3 (âm lịch)', whenEn:'From lunar month 1 (day 6) to end of month 3', where:'Hương Sơn, Mỹ Đức', vi:'Hành hương cầu bình an giữa cảnh núi non.', en2:'A Buddhist pilgrimage amid mountain scenery.', src:FSRC },
  { name:'Lễ hội gò Đống Đa', en:'Dong Da Mound Festival', when:'Mùng 5 Tết Nguyên Đán', whenEn:'5th day of Tet', where:'Gò Đống Đa, quận Đống Đa', vi:'Kỷ niệm chiến thắng Ngọc Hồi – Đống Đa của vua Quang Trung.', en2:'Marks Emperor Quang Trung’s Ngoc Hoi–Dong Da victory.', src:FSRC },
  { name:'Lễ hội làng Bát Tràng', en:'Bat Trang Village Festival', when:'14–16 tháng Hai (âm lịch)', whenEn:'14th–16th day of lunar month 2', where:'Đình Bát Tràng, Gia Lâm', vi:'Tri ân tổ nghề, tôn vinh làng gốm hàng trăm năm.', en2:'Honours the craft ancestors of the centuries-old ceramics village.', src:FSRC },
  { name:'Lễ hội chùa Thầy', en:'Thay Pagoda Festival', when:'5–7 tháng Ba (âm lịch)', whenEn:'5th–7th day of lunar month 3', where:'Sài Sơn, Quốc Oai', vi:'Tưởng nhớ thiền sư Từ Đạo Hạnh, tổ nghề múa rối nước.', en2:'Honours Zen master Tu Dao Hanh, regarded as founder of water puppetry.', src:FSRC },
]
