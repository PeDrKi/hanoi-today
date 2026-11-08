import { describe, it, expect } from 'vitest'
import { susScore, susBand, pearson, SUS_VI, SUS_EN } from '../sus'

describe('SUS', () => {
  it('has 10 items in both languages', () => { expect(SUS_VI).toHaveLength(10); expect(SUS_EN).toHaveLength(10) })
  it('best possible answers score 100, worst 0, neutral 50', () => {
    expect(susScore([5, 1, 5, 1, 5, 1, 5, 1, 5, 1])).toBe(100)
    expect(susScore([1, 5, 1, 5, 1, 5, 1, 5, 1, 5])).toBe(0)
    expect(susScore([3, 3, 3, 3, 3, 3, 3, 3, 3, 3])).toBe(50)
  })
  it('matches a worked example', () => { expect(susScore([4, 2, 4, 2, 4, 2, 4, 2, 4, 2])).toBe(75) })
  it('rejects incomplete or out-of-range answers', () => {
    expect(susScore([5, 1])).toBeNull(); expect(susScore(undefined)).toBeNull()
    expect(susScore([5, 1, 5, 1, 5, 1, 5, 1, 5, 6])).toBeNull(); expect(susScore([5, 1, 5, 1, 5, 1, 5, 1, 5, 2.5])).toBeNull()
  })
  it('bands follow Bangor et al.', () => { expect(susBand(50)).toBe('tệ'); expect(susBand(70)).toBe('tốt'); expect(susBand(95)).toBe('xuất sắc') })
  it('pearson', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1)
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1)
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull(); expect(pearson([1, 2], [1, 2])).toBeNull()
  })
})
