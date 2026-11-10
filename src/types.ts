export type Mood = 'calm' | 'adventure' | 'nostalgia' | 'energy'
export type Group = 'solo' | 'couple' | 'friends' | 'family'
export type GroupAnswer = Group | 'any'
export type PlaceType = 'attraction' | 'food' | 'cafe' | 'museum' | 'nature' | 'market' | 'lodging'
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'any'
export type TimeId = '2h' | 'half' | 'full'
export type Focus = 'all' | 'food' | 'cafe'
export type Mode = 'tourist' | 'local'
export type PriceQuality = 'menu' | 'partial' | 'est'

export interface MenuItem { n: string; p: number }
export interface MenuEntry { q: 'menu' | 'partial'; checked?: string; items: MenuItem[]; src?: string[]; note?: string }

export interface RawPlace {
  id: string; name: string; area: string; lat: number; lng: number
  type: PlaceType; moods: Mood[]; groups: Group[]; indoor: boolean
  timeOfDay: TimeOfDay[]; duration: number; cost: number
  desc: string; badges: string[]; tip: string
  /** Photo: https URL, or a file in public/places (see README). Optional — a drawn cover is shown without it. */
  image?: string; imageCredit?: string
  hours?: string; address?: string; closedNote?: string; note?: string   // giờ mở cửa "HH:MM–HH:MM" hoặc "24/24", địa chỉ, ngày nghỉ, ghi chú
  /** Điểm do ban biên tập chọn là "đáng đến nhất" (cột "Nổi bật" trong Excel) — luôn đứng đầu mục gợi ý trên bản đồ. */
  featured?: boolean
  img?: string; imgCredit?: string   // alias của image / imageCredit (tương thích dữ liệu mẫu SapaSense)
}
export interface Place extends RawPlace {
  priceQuality?: PriceQuality
  menu?: MenuItem[]; menuSrc?: string[]; menuChecked?: string; menuNote?: string
  bestMonths?: number[]; peakMonths?: number[]; season?: string
  localScore?: number; hiddenGem?: boolean; displayTime?: string | null
}

export interface LatLng { lat: number; lng: number }
/** A starting point chosen by the user: GPS fix or a preset area. */
export interface Loc extends LatLng { src?: 'gps' | 'area'; area?: string; label?: string }
export interface Weather { code?: number; temp?: number | string; icon?: string; label?: string; precip?: number; visibility?: number }

/** Everything the recommender needs to know about the user's wishes. */
export interface Answers {
  mood: Mood
  budget: number            // TỔNG ngân sách (VND) cho cả nhóm; số 1..5 = mức cũ (mỗi người)
  people?: number           // số người đi (mặc định 1)
  fitness?: 'normal' | 'limited'   // thể lực: 'limited' → bỏ các điểm phải đi bộ nhiều / nhiều bậc thang
  allergies?: string[]             // 'seafood' | 'peanut' | 'dairy' | 'gluten' | 'egg'
  compact?: boolean                // ngại kẹt xe / ít di chuyển → chỉ lấy điểm gần Hồ Hoàn Kiếm
  time: TimeId
  group: GroupAnswer
  mode?: Mode
  focus?: Focus
  auto?: boolean
  why?: string[]
  seed?: number | string
  loc?: Loc | null
  dayOffset?: number
  startHour?: number
  hidden?: string[]
  recent?: string[]
  visited?: string[]
  favs?: string[]
  /** Địa điểm người dùng muốn ghé (tối đa 3, mã trong dữ liệu): luôn được xếp vào lộ trình nếu còn mở cửa, phần còn lại do app gợi ý quanh đó. */
  must?: string[]
}

export type Warn = 'closed' | 'hours' | 'late' | null
export interface Why { k: string; v?: number }

export interface Stop {
  id: string; name: string; time: string; startAt: number; desc: string; badges: string[]
  lat: number; lng: number; tip: string; area: string; cost: number; type: PlaceType; indoor: boolean
  localScore?: number; hiddenGem?: boolean; displayTime?: string | null; warn: Warn
  image?: string; imageCredit?: string; hours?: string; address?: string
  why: Why[]; distKm: number | null
  /** Điểm do người dùng chọn trước, kèm lưu ý nếu nó không hợp ngân sách / thời tiết / mùa. */
  must?: boolean; mustNotes?: MustNote[]
  menu: MenuItem[] | null; menuSrc: string[] | null; menuChecked: string; menuNote: string
  priceQuality: PriceQuality | null
}

export type MustNote = 'budget' | 'weather' | 'offseason'
/** Điểm người dùng chọn nhưng không xếp được: đóng cửa ngày đó, ngoài khung giờ hợp, hoặc lộ trình không đủ chỗ. */
export interface Unmet { id: string; name: string; reason: 'closed' | 'time' | 'limit' }

export interface Plan {
  narrative: string; mode: Mode; startsTomorrow: boolean; startHour: number; dateISO: string
  stops: Stop[]
  unmet?: Unmet[]
}

/** Place after scheduling (before turning into a Stop). */
export interface TimedPlace extends Place { time: string; startAt: number; order: number; warn?: Warn }

export interface Review { date?: string; mood?: string; timeLabel?: string; groupLabel?: string; budgetLabel?: string; ratings?: Record<string, number>; sus?: number[]; susScore?: number; ctx?: Record<string, number>; comment?: string; stops?: string[] }

// ── memory ──
export interface Mark { t: number; on: boolean }
export type MarkKind = 'fav' | 'visited' | 'hidden'
export interface MemoryState {
  v: 2
  marks: Record<MarkKind, Record<string, Mark>>
  shown: Record<string, string>
  history: Record<string, { ids: string[]; t: number }>
}
