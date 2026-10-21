import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import App from './App'

test('shows the onboarding form with labeled fields in keyboard order', async () => {
  const user = userEvent.setup()
  render(<App />)

  expect(screen.getByText('Step 1 of 5')).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Onboarding Form', level: 1 })).toBeVisible()
  expect(screen.getByRole('form', { name: 'Onboarding Form' })).toBeVisible()

  for (const label of ['First Name', 'Last Name', 'Phone Number', 'Corporation Number']) {
    const input = screen.getByRole('textbox', { name: label })
    expect(input).toHaveValue('')
    expect(input).not.toHaveAttribute('aria-invalid', 'true')
    await user.tab()
    expect(input).toHaveFocus()
  }

  await user.tab()
  expect(screen.getByRole('button', { name: 'Submit' })).toHaveFocus()
})
