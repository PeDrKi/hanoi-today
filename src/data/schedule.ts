import { SCHEDULE_DATA } from './dataset'
// Opening constraints taken from the tips already in places.js.
// days: 0 = Sunday … 6 = Saturday. closeHour: last hour to start a visit.
export interface Opening { days?: number[]; openHour?: number; closeHour?: number }
export const SCHEDULE: Record<string, Opening> = SCHEDULE_DATA

export function isOpen(placeId: string, date: Date, startHour: number): boolean {
  const s = SCHEDULE[placeId]
  if (!s) return true
  if (s.days && !s.days.includes(date.getDay())) return false
  if (s.openHour != null && startHour < s.openHour - 1) return false
  if (s.closeHour != null && startHour >= s.closeHour) return false
  return true
}

// Tips written for one part of the day; swapped when the stop is scheduled at another time.
const TIME_TIPS: Record<string, { early: string | null; day: string | null; evening: string | null }> = {
  HK001: {
    early:   null, // original tip (before 8h) is the sunrise one
    day:     'Ban ngày hồ đông hơn buổi sớm — đi một vòng khoảng 30 phút, ghé Đền Ngọc Sơn nếu còn thời gian.',
    evening: 'Buổi tối đèn quanh hồ rất lung linh; đi bộ một vòng khoảng 30 phút.',
  },
}
export function tipFor(place: { id: string; tip: string }, startHour: number): string {
  const t = TIME_TIPS[place.id]
  if (!t) return place.tip
  if (startHour >= 17) return t.evening ?? place.tip
  if (startHour >= 8)  return t.day ?? place.tip
  return t.early ?? place.tip
}
