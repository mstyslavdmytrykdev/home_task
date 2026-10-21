import OnboardingForm from '../features/onboarding/components/OnboardingForm'

export default function App() {
  return (
    <main className="onboarding-page">
      <p className="onboarding-page__step">Step 1 of 5</p>
      <OnboardingForm />
    </main>
  )
}
