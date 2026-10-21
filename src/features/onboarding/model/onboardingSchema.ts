import { parsePhoneNumberFromString } from 'libphonenumber-js/max'
import { z } from 'zod'

const nameSchema = (label: string) => z.string()
  .trim()
  .min(1, `${label} is required`)
  .max(50, `${label} must be 50 characters or fewer`)

export const onboardingSchema = z.object({
  firstName: nameSchema('First name'),
  lastName: nameSchema('Last name'),
  phone: z.string()
    .min(1, 'Phone number is required')
    .refine((value) => {
      if (!value) return true
      if (!/^\+1\d{10}$/.test(value)) return false
      const phone = parsePhoneNumberFromString(value)
      return phone?.country === 'CA' && phone.isValid()
    }, 'Enter a valid Canadian phone number, such as +13062776103'),
  corporationNumber: z.string()
    .min(1, 'Corporation number is required')
    .refine((value) => !value || /^\d{9}$/.test(value), 'Corporation number must be exactly 9 digits'),
})

export type OnboardingValues = z.infer<typeof onboardingSchema>
