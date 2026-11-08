import type { Weather } from '../types'
import { isRainyCode } from './recommend'
import { HOT_C } from '../data/heat'

export interface Safety { level: 'danger' | 'warn' | 'info'; icon: string; text: string }

/**
 * Lời khuyên an toàn theo thời tiết hiện tại tại Hà Nội (mã thời tiết Open-Meteo + nhiệt độ).
 * Chỉ dựa trên dữ liệu thời tiết thật đang có; không có dữ liệu thì không cảnh báo.
 */
export function safetyAdvice(wx: Weather | null | undefined): Safety | null {
  if (!wx || wx.code == null) return null
  const code = wx.code, temp = typeof wx.temp === 'number' ? wx.temp : Number(wx.temp)
  if ([95, 96, 99].includes(code)) return { level:'danger', icon:'⛈', text:'Có giông / sấm sét: tránh đứng dưới cây, ven hồ, công viên và cầu; ở trong nhà cho đến khi tạnh.' }
  if (isRainyCode(code)) return { level:'warn', icon:'🌧', text:'Trời mưa: vỉa hè trơn, một số tuyến phố dễ ngập và kẹt xe. Ưu tiên bảo tàng, quán cà phê, chợ có mái; đặt xe công nghệ thay vì đi bộ xa.' }
  if (code === 45 || code === 48) return { level:'warn', icon:'🌫', text:'Sương mù / tầm nhìn thấp: đi chậm, bật đèn, chú ý khi qua đường và đi trên cầu.' }
  if (Number.isFinite(temp) && temp >= 37) return { level:'danger', icon:'🥵', text:`Nắng nóng gay gắt (${temp}°C): tránh ngoài trời 11h–15h, uống nước thường xuyên, nghỉ ở nơi có điều hoà; người già, trẻ nhỏ cần đặc biệt chú ý.` }
  if (Number.isFinite(temp) && temp >= HOT_C) return { level:'warn', icon:'☀️', text:`Trời nóng (${temp}°C): đội mũ, bôi kem chống nắng, mang nước; xếp điểm ngoài trời vào sáng sớm hoặc chiều muộn.` }
  if (Number.isFinite(temp) && temp <= 10) return { level:'warn', icon:'🥶', text:`Rét (${temp}°C): mang áo ấm nhiều lớp, buổi tối và sáng sớm lạnh hơn, chú ý khi đi xe máy.` }
  if (Number.isFinite(temp) && temp <= 15) return { level:'info', icon:'🧥', text:`Trời se lạnh (${temp}°C): mang áo khoác mỏng, buổi tối lạnh hơn.` }
  return null
}
