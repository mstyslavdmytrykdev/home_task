import TextField from '../../../shared/ui/TextField'
import './onboarding.scss'

export default function OnboardingForm() {
  return (
    <form
      className="onboarding-form"
      aria-labelledby="onboarding-title"
      noValidate
      onSubmit={(event) => event.preventDefault()}
    >
      <h1 id="onboarding-title">Onboarding Form</h1>
      <div className="onboarding-form__fields">
        <div className="onboarding-form__names">
          <TextField label="First Name" name="firstName" autoComplete="given-name" />
          <TextField label="Last Name" name="lastName" autoComplete="family-name" />
        </div>
        <TextField label="Phone Number" name="phone" type="tel" autoComplete="tel" />
        <TextField label="Corporation Number" name="corporationNumber" inputMode="numeric" />
      </div>
      <button className="onboarding-form__submit" type="submit">
        Submit <span aria-hidden="true">→</span>
      </button>
    </form>
  )
}
