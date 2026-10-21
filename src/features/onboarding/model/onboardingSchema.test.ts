import { describe, expect, test } from 'vitest'
import { onboardingSchema } from './onboardingSchema'

const validValues = {
  firstName: 'Jane',
  lastName: 'Smith',
  phone: '+13062776103',
  corporationNumber: '826417395',
}

test('trims names and preserves phone and corporation values', () => {
  expect(onboardingSchema.parse({ ...validValues, firstName: ' Jane ', lastName: ' Smith ' }))
    .toEqual(validValues)
})

describe.each(['firstName', 'lastName'] as const)('%s', (field) => {
  test.each(['', '   ', 'a'.repeat(51)])('rejects an empty, blank, or oversized name: %j', (value) => {
    expect(onboardingSchema.safeParse({ ...validValues, [field]: value }).success).toBe(false)
  })
  test('accepts 50 characters', () => {
    expect(onboardingSchema.safeParse({ ...validValues, [field]: 'a'.repeat(50) }).success).toBe(true)
  })
})

test.each(['', '+14155552671', '+13060000000', '13062776103', '+1 3062776103', '+1(306)2776103', '+1306-277-6103', '++13062776103', '+1306277610a'])('rejects invalid phone %j', (phone) => {
  expect(onboardingSchema.safeParse({ ...validValues, phone }).success).toBe(false)
})

test.each(['', '12345678', '1234567890', '         ', 'ABC123456', '1234 6789', ' 12345678', '12345678 ', '１２３４５６７８９'])('rejects malformed corporation number: %j', (corporationNumber) => {
  expect(onboardingSchema.safeParse({ ...validValues, corporationNumber }).success).toBe(false)
})

test('accepts nine digits and preserves leading zeros', () => {
  expect(onboardingSchema.parse({ ...validValues, corporationNumber: '012345678' }).corporationNumber).toBe('012345678')
})
