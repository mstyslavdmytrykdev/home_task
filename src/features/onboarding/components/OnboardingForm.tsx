import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { onboardingSchema } from '../model/onboardingSchema'
import type { OnboardingValues } from '../model/onboardingSchema'
import { useCorporationValidation } from '../hooks/useCorporationValidation'
import TextField from '../../../shared/ui/TextField'
import './onboarding.scss'

export default function OnboardingForm() {
  const { register, handleSubmit, getValues, getFieldState, setError, clearErrors, formState: { errors } } = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: { firstName: '', lastName: '', phone: '', corporationNumber: '' },
  })

  const corporation = useCorporationValidation({ getValues, getFieldState, setError, clearErrors })
  const firstNameField = register('firstName')
  const lastNameField = register('lastName')
  const phoneField = register('phone')
  const corporationField = register('corporationNumber')

  return (
    <form
      className="onboarding-form"
      aria-labelledby="onboarding-title"
      noValidate
      onSubmit={(event) => {
        // POST submission is added in the next phase.
        void handleSubmit(
          async (values) => { await corporation.verify(values.corporationNumber) },
          async () => { await corporation.verify(getValues('corporationNumber')) },
        )(event)
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
            {...firstNameField}
          />
          <TextField
            label="Last Name"
            autoComplete="family-name"
            maxLength={50}
            required
            error={errors.lastName?.message}
            {...lastNameField}
          />
        </div>
        <TextField
          label="Phone Number"
          type="tel"
          autoComplete="tel"
          required
          error={errors.phone?.message}
          {...phoneField}
        />
        <TextField
          label="Corporation Number"
          type="text"
          inputMode="numeric"
          maxLength={9}
          required
          error={errors.corporationNumber?.message}
          {...corporationField}
          onChange={(event) => {
            corporation.invalidate()
            void corporationField.onChange(event)
          }}
          onBlur={(event) => {
            const number = getValues('corporationNumber')
            void corporationField.onBlur(event).then(() => corporation.verify(number))
          }}
        />
        <p className="onboarding-form__status" role="status">
          {corporation.status === 'checking' ? 'Checking corporation number…' : ''}
        </p>
      </div>
      <button className="onboarding-form__submit" type="submit">
        Submit <span aria-hidden="true">→</span>
      </button>
    </form>
  )
}
