// System Usability Scale (Brooke, 1996) + context-factor items for the study. Pure functions, no UI.
export const SUS_VI = [
  'Tôi nghĩ rằng mình sẽ muốn dùng hệ thống này thường xuyên.',
  'Tôi thấy hệ thống phức tạp một cách không cần thiết.',
  'Tôi thấy hệ thống dễ sử dụng.',
  'Tôi nghĩ mình cần sự hỗ trợ của người có chuyên môn để dùng được hệ thống này.',
  'Tôi thấy các chức năng trong hệ thống được tích hợp tốt.',
  'Tôi thấy hệ thống có quá nhiều điểm không nhất quán.',
  'Tôi nghĩ hầu hết mọi người sẽ học cách dùng hệ thống này rất nhanh.',
  'Tôi thấy hệ thống rất rườm rà, khó thao tác.',
  'Tôi cảm thấy rất tự tin khi sử dụng hệ thống.',
  'Tôi cần học nhiều thứ trước khi có thể bắt đầu dùng hệ thống này.',
]
export const SUS_EN = [
  'I think that I would like to use this system frequently.',
  'I found the system unnecessarily complex.',
  'I thought the system was easy to use.',
  'I think that I would need the support of a technical person to be able to use this system.',
  'I found the various functions in this system were well integrated.',
  'I thought there was too much inconsistency in this system.',
  'I would imagine that most people would learn to use this system very quickly.',
  'I found the system very cumbersome to use.',
  'I felt very confident using the system.',
  'I needed to learn a lot of things before I could get going with this system.',
]
/** Context factors the study asks about (1–5): how much each one shaped the plan, and intention to use. */
export const CTX_KEYS = ['mood', 'weather', 'time', 'budget', 'intent'] as const
export type CtxKey = typeof CTX_KEYS[number]
export const CTX_VI: Record<CtxKey, string> = {
  mood: 'Tâm trạng tôi chọn ảnh hưởng mạnh đến việc tôi thấy lộ trình phù hợp.',
  weather: 'Việc lộ trình tính đến thời tiết hiện tại là quan trọng với tôi.',
  time: 'Việc lộ trình tính đến thời điểm trong ngày là quan trọng với tôi.',
  budget: 'Việc lộ trình bám sát ngân sách của tôi là quan trọng với tôi.',
  intent: 'Tôi có ý định tiếp tục dùng hệ thống này để lên kế hoạch đi chơi.',
}
export const CTX_EN: Record<CtxKey, string> = {
  mood: 'The mood I chose strongly affected how suitable the plan felt.',
  weather: 'It matters to me that the plan takes current weather into account.',
  time: 'It matters to me that the plan takes the time of day into account.',
  budget: 'It matters to me that the plan sticks to my budget.',
  intent: 'I intend to keep using this system to plan my outings.',
}

/** answers = 10 integers 1–5 in item order. Returns 0–100, or null if incomplete/invalid. */
export function susScore(answers: readonly number[] | undefined | null): number | null {
  if (!answers || answers.length !== 10) return null
  let sum = 0
  for (let i = 0; i < 10; i++) {
    const a = answers[i]
    if (!Number.isInteger(a) || a < 1 || a > 5) return null
    sum += i % 2 === 0 ? a - 1 : 5 - a       // items 1,3,5,7,9 are positive; 2,4,6,8,10 negative
  }
  return sum * 2.5
}
/** Bangor et al. (2008) rating bands, used in the Admin summary. */
export function susBand(score: number): 'tệ' | 'tạm' | 'tốt' | 'rất tốt' | 'xuất sắc' {
  return score < 51 ? 'tệ' : score < 68 ? 'tạm' : score < 80.3 ? 'tốt' : score < 90 ? 'rất tốt' : 'xuất sắc'
}
/** Pearson correlation; null when fewer than 3 pairs or no variance. */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length)
  if (n < 3) return null
  const mx = xs.slice(0, n).reduce((a, b) => a + b, 0) / n, my = ys.slice(0, n).reduce((a, b) => a + b, 0) / n
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy }
  return sxx === 0 || syy === 0 ? null : sxy / Math.sqrt(sxx * syy)
}
