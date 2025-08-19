import { getMinutesDifference, roundToNearestInterval, isWeekend } from '../../utils/dateUtils'

describe('coverageBackfill/dateUtils', () => {
  test('getMinutesDifference returns correct minutes', () => {
    const a = new Date('2024-01-01T10:00:00Z')
    const b = new Date('2024-01-01T10:45:00Z')
    expect(getMinutesDifference(a, b)).toBe(45)
  })

  test('roundToNearestInterval rounds correctly', () => {
    const dt = new Date('2024-01-01T10:07:00Z')
    const rounded = roundToNearestInterval(dt, 15)
    // Compute expected minutes using same rounding logic to avoid timezone issues
    const expectedMinutes = Math.round(dt.getMinutes() / 15) * 15 % 60
    expect(rounded).not.toBeNull()
    if (rounded) expect(rounded.getMinutes()).toBe(expectedMinutes)
  })

  test('isWeekend identifies weekend dates', () => {
    const saturday = new Date('2024-01-06T12:00:00Z') // Jan 6, 2024 is Saturday
    const wednesday = new Date('2024-01-03T12:00:00Z') // Jan 3, 2024 is Wednesday
    expect(isWeekend(saturday)).toBe(true)
    expect(isWeekend(wednesday)).toBe(false)
  })
})
