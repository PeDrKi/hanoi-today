/** Hà Nội is flat but hot and humid in summer. Outdoor stops in the sun between 11:00 and 15:00 get a heat note once it is warm enough. */
export const HOT_C = 33
export const HEAT_START = 11
export const HEAT_END = 15

export function isHeatRisk(p: { indoor: boolean; type: string }, startHour: number, temp: number | string | null | undefined): boolean {
  const t = typeof temp === 'number' ? temp : Number(temp)
  return Number.isFinite(t) && t >= HOT_C && !p.indoor && startHour >= HEAT_START && startHour < HEAT_END
}
