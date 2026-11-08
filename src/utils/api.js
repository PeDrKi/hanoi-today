/**
 * api.js — AI Engine
 * Engine: Google Gemini 1.5 Flash (FREE — 15 req/phút, 1500 req/ngày)
 *
 * Cách lấy API key:
 *   1. Vào https://aistudio.google.com
 *   2. Đăng nhập bằng Google
 *   3. Click "Get API Key" → "Create API Key"
 *   4. Copy key vào file .env:  VITE_GEMINI_KEY=AIzaSy...
 */

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent'

// ─── HELPER: gọi Gemini API ───────────────────────────
async function callGemini(prompt) {
  const key = import.meta.env.VITE_GEMINI_KEY

  if (!key) {
    throw new Error(
      'Chưa có API key! Tạo file .env và thêm: VITE_GEMINI_KEY=AIzaSy...\n' +
      'Lấy key miễn phí tại: https://aistudio.google.com'
    )
  }

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${key}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature:     0.8,
        topP:            0.95,
        maxOutputTokens: 2048,
      }
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
    const msg = err?.error?.message || res.statusText
    throw new Error(`Gemini API lỗi ${res.status}: ${msg}`)
  }

  const data = await res.json()

  // Gemini trả về: data.candidates[0].content.parts[0].text
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!raw) throw new Error('Gemini không trả về nội dung. Thử lại sau.')

  // Strip markdown fences nếu model vẫn wrap JSON
  const clean = raw.trim().replace(/^```json\s*/i, '').replace(/\s*```$/,'').trim()
  return JSON.parse(clean)
}

// ─── PROMPT #1: Lộ trình ─────────────────────────────
export function buildPrompt({ moodLabel, budgetLabel, timeLabel, groupLabel, wxStr, tod, dow }) {
  return `Bạn là chuyên gia du lịch Hà Nội địa phương, am hiểu sâu văn hóa và địa lý thành phố.

Tạo lộ trình du lịch Hà Nội cá nhân hóa theo thông tin:
- Tâm trạng: ${moodLabel}
- Ngân sách: ${budgetLabel}
- Thời gian: ${timeLabel}
- Nhóm: ${groupLabel}
- Thời tiết: ${wxStr}
- Thời điểm: ${tod}, ${dow}

Trả về JSON thuần (không markdown, không backtick, không giải thích):
{
  "narrative": "1-2 câu thơ văn ngắn, gợi cảm xúc về hành trình này",
  "stops": [
    {
      "name": "Tên địa điểm thực tế tại Hà Nội",
      "time": "Giờ gợi ý, vd: 8:00 - 9:30",
      "desc": "Mô tả 1-2 câu cảm xúc như đang kể chuyện",
      "badges": ["Chi phí cụ thể", "Phương tiện di chuyển", "Trong/Ngoài nhà"],
      "lat": số_thực_vĩ_độ,
      "lng": số_thực_kinh_độ
    }
  ]
}

Quan trọng:
- Địa điểm THỰC TẾ tại Hà Nội, tọa độ lat/lng CHÍNH XÁC (vd: Hồ Hoàn Kiếm lat:21.0285 lng:105.8522)
- Mưa hoặc nhiệt độ trên 36°C → ưu tiên địa điểm trong nhà
- Số điểm phù hợp thời gian: 2h=2-3 điểm, nửa ngày=4-5 điểm, cả ngày=6-8 điểm
- Chỉ trả về JSON thuần, tiếng Việt, có cảm xúc`
}

// ─── PROMPT #2: Chỗ ở & Di chuyển ────────────────────
export function buildAccommodationPrompt({ budgetLabel, groupLabel, timeLabel, stopNames }) {
  return `Bạn là chuyên gia du lịch Hà Nội, am hiểu giá cả khách sạn và phương tiện di chuyển nội thành.

Dựa trên thông tin chuyến đi:
- Ngân sách: ${budgetLabel}
- Nhóm: ${groupLabel}
- Thời gian: ${timeLabel}
- Lộ trình: ${stopNames.join(' → ')}

Trả về JSON thuần (không markdown, không backtick, không giải thích):
{
  "accommodations": [
    {
      "name": "Tên khách sạn/homestay/hostel thực tế tại Hà Nội",
      "type": "Hostel / Homestay / Khách sạn 2-3 sao / Khách sạn 4-5 sao",
      "area": "Khu vực (Hoàn Kiếm / Tây Hồ / Ba Đình / ...)",
      "price": "Giá mỗi đêm (vd: 250.000đ - 400.000đ/đêm)",
      "desc": "1 câu mô tả điểm nổi bật",
      "pros": ["Ưu điểm 1", "Ưu điểm 2"],
      "suitable": true
    }
  ],
  "transport": [
    {
      "from": "Điểm xuất phát",
      "to": "Điểm đến",
      "mode": "Đi bộ / Xe buýt / Grab xe máy / Grab ô tô / Xe đạp",
      "duration": "Thời gian ước tính",
      "cost": "Chi phí ước tính",
      "tip": "Mẹo di chuyển ngắn"
    }
  ],
  "budgetSummary": {
    "accommodation": "Tổng chi phí chỗ ở",
    "transport": "Tổng chi phí di chuyển",
    "total": "Tổng cộng cả chuyến"
  }
}

Quan trọng:
- Tên khách sạn THỰC TẾ, phù hợp ngân sách ${budgetLabel}
- Gợi ý 2-3 chỗ ở, đánh dấu suitable:true cho lựa chọn phù hợp nhất
- Di chuyển: từng chặng trong lộ trình, ưu tiên tiết kiệm
- Chỉ trả JSON thuần, tiếng Việt`
}

// ─── EXPORTS ─────────────────────────────────────────
// Giữ tên hàm cũ để không cần sửa các file khác
export const callClaude              = callGemini
export const callClaudeAccommodation = callGemini
