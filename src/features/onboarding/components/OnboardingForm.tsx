import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { onboardingSchema } from '../model/onboardingSchema'
import type { OnboardingValues } from '../model/onboardingSchema'
import TextField from '../../../shared/ui/TextField'
import './onboarding.scss'

export default function OnboardingForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: { firstName: '', lastName: '', phone: '', corporationNumber: '' },
  })

  return (
    <form
      className="onboarding-form"
      aria-labelledby="onboarding-title"
      noValidate
      onSubmit={(event) => {
        // Submission will be connected once corporation verification is available.
        void handleSubmit(() => undefined)(event)
      }}
    >
      <h1 id="onboarding-title">Onboarding Form</h1>
      <div className="onboarding-form__fields">
        <div className="onboarding-form__names">
          <TextField
            label="First Name"
            autoComplete="given-name"
            maxLength={50}
            required
            error={errors.firstName?.message}
            {...register('firstName')}
          />
          <TextField
            label="Last Name"
            autoComplete="family-name"
            maxLength={50}
            required
            error={errors.lastName?.message}
            {...register('lastName')}
          />
        </div>
        <TextField
          label="Phone Number"
          type="tel"
          autoComplete="tel"
          required
          error={errors.phone?.message}
          {...register('phone')}
        />
        <TextField
          label="Corporation Number"
          type="text"
          inputMode="numeric"
          maxLength={9}
          required
          error={errors.corporationNumber?.message}
          {...register('corporationNumber')}
        />
      </div>
      <button className="onboarding-form__submit" type="submit">
        Submit <span aria-hidden="true">→</span>
      </button>
    </form>
  )
}
