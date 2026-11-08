import type { DayForecast } from './forecast'

export interface Packing { outfit: string; items: string[] }

/** Clothing + gear advice from the day's forecast for Hà Nội. General guidance, not a guarantee. */
export function packingAdvice(day: Pick<DayForecast, 'tMax' | 'tMin' | 'rainProb' | 'rainMm' | 'code' | 'uv' | 'wind'>, opts: { en?: boolean; limitedFitness?: boolean; compact?: boolean } = {}): Packing {
  const en = !!opts.en
  const T = (vi: string, e: string) => en ? e : vi
  const items: string[] = []
  const { tMax, tMin, rainProb, rainMm, uv, wind, code } = day

  let outfit: string
  if (tMin <= 8)        outfit = T('Rét: áo giữ nhiệt + áo len + áo khoác dày chống gió, khăn quàng, găng tay.', 'Cold: thermal layer + sweater + thick windproof jacket, scarf, gloves.')
  else if (tMin <= 14)  outfit = T('Lạnh: áo len/áo khoác, quần dài; buổi sáng sớm và tối còn lạnh hơn.', 'Cold: sweater or jacket, long trousers; mornings and evenings are colder.')
  else if (tMin <= 20)  outfit = T('Se lạnh: áo dài tay + áo khoác mỏng, quần dài.', 'Cool: long sleeves + a light jacket, long trousers.')
  else if (tMax >= 35)  outfit = T('Nắng nóng: áo thoáng, sáng màu, chất liệu cotton/linen; mũ rộng vành, kính râm.', 'Very hot: light, breathable clothes (cotton/linen), wide-brim hat, sunglasses.')
  else if (tMax >= 30)  outfit = T('Nóng ẩm: áo phông thoáng, quần ngắn hoặc váy nhẹ; mang 1 áo mỏng cho nơi bật điều hoà mạnh.', 'Hot and humid: breathable tee, shorts or a light skirt; bring a thin layer for strong air-conditioning.')
  else                  outfit = T('Dễ chịu: áo phông/áo dài tay mỏng và 1 áo khoác nhẹ cho buổi tối.', 'Mild: tee or thin long sleeves and a light jacket for the evening.')
  if (tMax - tMin >= 9) items.push(T('🧅 Chênh lệch nhiệt độ ngày–đêm lớn: mặc nhiều lớp, dễ cởi bớt.', '🧅 Big day–night swing: dress in layers.'))

  const rainy = rainProb >= 50 || rainMm >= 2 || [51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(code)
  if (rainy) {
    items.push(T(`☂️ Có khả năng mưa (${rainProb}%): áo mưa mỏng hoặc ô; giày chống trơn (vỉa hè và bậc đá hay trơn); túi chống nước cho điện thoại.`, `☂️ Rain likely (${rainProb}%): poncho or umbrella; non-slip shoes (pavements and stone steps get slippery); waterproof pouch for your phone.`))
    items.push(T('🧦 Mang thêm 1 đôi tất khô; vài tuyến phố cũ dễ ngập khi mưa lớn.', '🧦 Pack a spare pair of dry socks; some old streets flood in heavy rain.'))
  } else if (rainProb >= 25) items.push(T(`🌂 Mưa rải rác có thể xảy ra (${rainProb}%): mang ô gấp nhỏ gọn.`, `🌂 Scattered showers possible (${rainProb}%): carry a compact umbrella.`))
  if (uv >= 6) items.push(T('🧴 Chỉ số UV cao: kem chống nắng, mũ, kính râm; tránh đứng ngoài nắng 11h–15h.', '🧴 High UV: sunscreen, hat, sunglasses; avoid long stretches in the sun from 11:00 to 15:00.'))
  if (tMax >= 33) items.push(T('💧 Trời nóng: mang chai nước, nghỉ ở quán cà phê/bảo tàng có điều hoà giữa trưa.', '💧 Hot day: carry water and take a midday break in an air-conditioned café or museum.'))
  if (wind >= 30) items.push(T('🧥 Gió mạnh: áo khoác chống gió, giữ chặt mũ.', '🧥 Strong wind: windproof jacket, hold on to your hat.'))
  if (code === 45 || code === 48) items.push(T('🌫 Có sương mù: mặc đồ sáng màu, chú ý khi qua đường, đi chậm.', '🌫 Fog: bright clothes, take care crossing streets, go slowly.'))
  items.push(T('👟 Giày đi bộ êm (phố cổ và vỉa hè nhiều đoạn gồ ghề), nước uống, pin dự phòng; mang tiền mặt cho quán nhỏ và chợ.', '👟 Comfortable walking shoes (the Old Quarter has uneven pavements), water, power bank; carry some cash for small eateries and markets.'))
  if (opts.compact) items.push(T('🛵 Giờ cao điểm (7–9h, 17–19h) đường rất đông: chọn xe công nghệ hoặc đi bộ trong khu gần nhau.', '🛵 Rush hours (7–9, 17–19) are very busy: use ride-hailing or walk between nearby stops.'))
  if (opts.limitedFitness) items.push(T('🪑 Đi bộ chậm, nghỉ thường xuyên ở quán cà phê ven đường; hạn chế các điểm nhiều bậc thang.', '🪑 Walk slowly and rest often at street cafés; avoid stops with many steps.'))
  return { outfit, items }
}
